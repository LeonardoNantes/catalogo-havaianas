// ============================================================
// CONEXÃO COM O SUPABASE
// ============================================================
// Busca os produtos reais no Supabase. Se as credenciais em config.js
// ainda não foram preenchidas (ou der algum erro de conexão), o app
// usa os produtos de exemplo (MOCK_PRODUCTS) automaticamente — assim
// o catálogo nunca fica em branco.

// Monta o link público da foto a partir do código representante do card.
// Padrão: {url}/storage/v1/object/public/{bucket}/{codigo}.jpg
function montarUrlImagem(codigo) {
  const { url, bucketImagens } = CONFIG.supabase;
  return `${url}/storage/v1/object/public/${bucketImagens}/${codigo}.jpg`;
}

// ---------- Descobrir QUEM é o vendedor a partir do link usado ----------
// Prioridade 1: parâmetro ?v=slug na URL — usado por vendedores cadastrados
// DEPOIS da migração pro site único (mesmo padrão do "Ofertas da Semana").
// Prioridade 2: domínio antigo (ex: catalogo-havaianas-wesley.vercel.app),
// consultado na tabela "dominios_antigos" — usado pelos vendedores que já
// tinham catálogo próprio individual antes da migração, pra não precisar
// trocar o link que já está com os clientes deles.
// Retorna o slug (string) ou null se não conseguir identificar ninguém.
async function resolverVendedorId() {
  const params = new URLSearchParams(window.location.search);
  const vParam = params.get("v");
  if (vParam) return vParam.trim();

  const { url, anonKey } = CONFIG.supabase;
  if (!url || !anonKey) return null;

  try {
    const client = window.supabase.createClient(url, anonKey);
    const dominio = window.location.hostname;
    const { data, error } = await client
      .from("dominios_antigos")
      .select("slug")
      .eq("dominio", dominio)
      .maybeSingle();

    if (error || !data) return null;
    return data.slug;
  } catch (erro) {
    console.error("[Havaianas] Erro ao resolver vendedor pelo domínio:", erro);
    return null;
  }
}

// Grava uma linha na tabela "ofertas_visualizacoes" toda vez que um catálogo
// é aberto — é o que alimenta a tela "Acessos" do Painel de Vendedores. Roda
// em segundo plano (não espera resposta, não trava o carregamento do
// catálogo) e qualquer erro fica só no console, nunca interrompe o app pro
// cliente.
function registrarAcesso(vendedorId) {
  const { url, anonKey } = CONFIG.supabase;
  if (!url || !anonKey || !vendedorId) return;

  try {
    const client = window.supabase.createClient(url, anonKey);
    client
      .from("ofertas_visualizacoes")
      .insert({ vendedor_slug: vendedorId })
      .then(({ error }) => {
        if (error) console.error("[Havaianas] Erro ao registrar acesso:", error);
      });
  } catch (erro) {
    console.error("[Havaianas] Erro ao registrar acesso:", erro);
  }
}

// Busca na tabela "vendedores" os dados desse vendedor: se está ativo
// (assinatura em dia), qual é a ÁREA de preço dele (SC, PR, etc.), e os
// dados que aparecem no cabeçalho (nome, foto, whatsapp).
// "encontrado: false" quer dizer que o slug não existe na tabela - nesse
// caso mostramos a tela de "catálogo não encontrado", NÃO o catálogo
// normal (diferente do padrão antigo, porque aqui não temos mais nenhum
// dado fixo de vendedor pra usar como retaguarda).
async function buscarStatusVendedor(vendedorId) {
  const { url, anonKey } = CONFIG.supabase;
  const semDados = { encontrado: false, ativo: true, area: "SC", foto_url: null, nome: "", whatsapp: "" };

  if (!url || !anonKey || !vendedorId) return semDados;

  try {
    const client = window.supabase.createClient(url, anonKey);
    const { data, error } = await client
      .from("vendedores")
      .select("ativo, area, foto_url, nome, whatsapp")
      .eq("slug", vendedorId)
      .maybeSingle();

    if (error) {
      // Erro de rede/conexão: não temos como saber quem é o vendedor,
      // então mostramos a tela de "não encontrado" (não dá pra abrir o
      // catálogo sem nome/whatsapp de ninguém pra usar).
      console.error("[Havaianas] Erro ao checar status do vendedor:", error);
      return semDados;
    }
    if (!data) return semDados; // slug realmente não existe na tabela

    return {
      encontrado: true,
      ativo: data.ativo !== false,
      area: data.area || "SC",
      foto_url: data.foto_url || null,
      nome: data.nome || "",
      whatsapp: data.whatsapp || "",
    };
  } catch (erro) {
    console.error("[Havaianas] Erro ao checar status do vendedor:", erro);
    return semDados;
  }
}

// Um card do catálogo Havaianas é um produto+cor (não um código só) — várias
// numerações compartilham a mesma foto. Aqui a gente agrupa por
// segmento+coleção+cor, pega o código de menor numeração de cada grupo como
// "representante", e usa a foto dele (nomeada assim no bucket) pra todas as
// numerações-irmãs daquele grupo.
function aplicarFotoDoGrupo(produtos) {
  const grupos = new Map(); // "segmento|colecao|cor" -> produtos do grupo
  produtos.forEach((p) => {
    const chave = `${p.segmento}|${p.colecao}|${p.cor}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  });

  grupos.forEach((itensDoGrupo) => {
    const representante = itensDoGrupo.reduce((menor, atual) => {
      const numAtual = parseInt(atual.numeracao, 10);
      const numMenor = parseInt(menor.numeracao, 10);
      return numAtual < numMenor ? atual : menor;
    }, itensDoGrupo[0]);

    const urlFoto = representante.imagem_url || montarUrlImagem(representante.codigo);
    itensDoGrupo.forEach((p) => {
      p.imagem_url = urlFoto;
    });
  });

  return produtos;
}

// "area" é a área de preço do vendedor logado (vem de buscarStatusVendedor).
async function buscarProdutos(area) {
  const { url, anonKey, tabela } = CONFIG.supabase;

  const semSupabaseConfigurado = !url || !anonKey;
  if (semSupabaseConfigurado) {
    console.info("[Havaianas] Supabase não configurado ainda — usando produtos de exemplo.");
    return aplicarFotoDoGrupo(MOCK_PRODUCTS);
  }

  try {
    const client = window.supabase.createClient(url, anonKey);
    // Ordena pela coluna "ordem" (posição pensada por segmento/coleção/cor) em
    // vez de ordem alfabética — assim segmentos, coleções e produtos aparecem
    // sempre na mesma ordem, já pensada pra facilitar o cliente achar o item.
    const { data, error } = await client
      .from(tabela)
      .select("*")
      .eq("ativo", true)
      .eq("area", area || "SC")
      .order("ordem", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn("[Havaianas] Supabase conectou mas não retornou produtos — usando exemplo.");
      return aplicarFotoDoGrupo(MOCK_PRODUCTS);
    }

    return aplicarFotoDoGrupo(data);
  } catch (erro) {
    console.error("[Havaianas] Erro ao buscar produtos no Supabase:", erro);
    return aplicarFotoDoGrupo(MOCK_PRODUCTS);
  }
}
