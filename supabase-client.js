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

// Confere na tabela "vendedores" se este catálogo está ativo (assinatura em dia).
// Por segurança, qualquer situação incerta (sem config, erro de rede, linha não
// encontrada) deixa o catálogo ATIVO — só pausa quando a gente tem certeza que
// o vendedor foi marcado como inativo de propósito.
async function verificarVendedorAtivo() {
  const { url, anonKey } = CONFIG.supabase;
  const vendedorId = CONFIG.vendedorId;

  if (!url || !anonKey || !vendedorId) return true;

  try {
    const client = window.supabase.createClient(url, anonKey);
    const { data, error } = await client
      .from("vendedores")
      .select("ativo")
      .eq("slug", vendedorId)
      .maybeSingle();

    if (error || !data) return true;
    return data.ativo !== false;
  } catch (erro) {
    console.error("[Havaianas] Erro ao checar status do vendedor:", erro);
    return true;
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

async function buscarProdutos() {
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
