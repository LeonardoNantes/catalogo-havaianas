// ============================================================
// LÓGICA DO CATÁLOGO HAVAIANAS — versão com NAVEGAÇÃO POR ABAS (igual ao
// formato já usado no Nadir/Impala): segmentos e coleções viram duas
// faixas de abas no topo, numa tela só (antes eram 3 telas separadas:
// segmentos, coleções, produtos). O carrinho e o envio pelo WhatsApp
// continuam exatamente iguais. Reconhece o vendedor por ?v= ou domínio
// antigo.
// ============================================================

// codigo -> { produto, quantidade }
// "quantidade" é sempre número de PARES. Cada clique no +/- soma ou tira
// "produto.fracao" pares de uma vez (1 = unitário, ou 2 / 6 quando a
// coleção só é vendida em múltiplos, ex: Top Adulto, Tradicional).
const carrinho = new Map();
let TODOS_PRODUTOS = [];
let PRODUTOS_POR_SEGMENTO = new Map(); // segmento -> [produtos]
let SEGMENTO_ATUAL = null;
let COLECAO_ATUAL = null;
let BUSCA_ATIVA = ""; // texto da busca geral (vazio = sem busca, mostra a aba normal)
let VENDEDOR_ATUAL = null; // { nome, whatsapp, foto_url, area, ... } do vendedor resolvido nesse acesso
let SLUG_VENDEDOR_ATUAL = null; // slug usado pra separar o carrinho guardado no celular por vendedor

// Ordem fixa dos segmentos nas abas (decidida com o Leonardo) — não é a
// ordem que vem do banco, por isso precisa estar explícita aqui.
const SEGMENTO_ORDEM = ["Unissex", "Masculino", "Feminino", "Kids / Baby", "Licenças Adultas"];
// Só pra EXIBIÇÃO da aba — o valor de verdade salvo no banco (usado pra
// filtrar/agrupar produtos) continua sendo "Licenças Adultas".
const SEGMENTO_ROTULO = { "Licenças Adultas": "Licenciados" };

// Ordem fixa das abas de COLEÇÃO dentro do Unissex (pedido do Leonardo) —
// as outras coleções continuam em ordem alfabética (ver ordenarColecoes).
// "Top Senses" é o nome exato gravado no banco (conferido no Supabase).
const COLECAO_ORDEM_UNISSEX = ["Top Adulto", "Brasil", "Tradicional", "Top Senses", "Top Vibes"];

// Ordena os nomes de coleção de um segmento: no Unissex segue a ordem fixa
// acima (uma coleção nova que apareça lá e ainda não esteja na lista cai no
// final, em ordem alfabética); nos demais segmentos é sempre alfabética.
function ordenarColecoes(segmento, nomes) {
  if (segmento !== "Unissex") {
    return [...nomes].sort(compararTexto);
  }
  return [...nomes].sort((a, b) => {
    const posA = COLECAO_ORDEM_UNISSEX.indexOf(a);
    const posB = COLECAO_ORDEM_UNISSEX.indexOf(b);
    if (posA === -1 && posB === -1) return compararTexto(a, b);
    if (posA === -1) return 1;
    if (posB === -1) return -1;
    return posA - posB;
  });
}

// ---------- Formatação ----------
function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Tira acento e caixa, pra busca não se importar com maiúscula/minúscula
// nem acentuação ("Nao" acha "Não", "AZUL" acha "azul" etc).
function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

// ---------- Navegação entre telas ----------
function mostrarTela(idTela, direcao = "frente") {
  document.querySelectorAll(".tela").forEach((tela) => {
    const éAlvo = tela.id === idTela;
    tela.hidden = !éAlvo;
    tela.classList.remove("tela-anim-frente", "tela-anim-voltar");
    if (éAlvo) {
      void tela.offsetWidth; // força reflow pra reiniciar a animação
      tela.classList.add(direcao === "voltar" ? "tela-anim-voltar" : "tela-anim-frente");
    }
  });
  // A barra fixa "ir pro carrinho" só faz sentido na tela do catálogo —
  // não aparece na tela do próprio carrinho, na de pausado nem na de
  // "não encontrado".
  const barraCarrinho = document.getElementById("barra-ir-carrinho");
  barraCarrinho.hidden = idTela !== "tela-catalogo";
  window.scrollTo(0, 0);
}

// ---------- Cabeçalho: parte que é igual pra todo mundo (marca) ----------
function iniciarCabecalhoMarca() {
  document.getElementById("nome-catalogo").textContent = CONFIG.nomeCatalogo;
  document.getElementById("vendedor-foto").src = CONFIG.vendedorPadrao.foto;
  document.documentElement.style.setProperty("--cor-primaria", CONFIG.corPrimaria);
  document.documentElement.style.setProperty("--cor-destaque", CONFIG.corDestaque);
  document.title = CONFIG.nomeCatalogo;
}

// ---------- Cabeçalho: parte que depende do vendedor identificado ----------
function preencherCabecalhoVendedor(vendedor) {
  document.getElementById("vendedor-nome").textContent = vendedor.nome || "Vendedor";
  if (vendedor.foto_url) {
    document.getElementById("vendedor-foto").src = vendedor.foto_url;
  }
}

// ---------- Agrupamento ----------
function agruparPor(produtos, chave) {
  const mapa = new Map();
  produtos.forEach((p) => {
    if (!mapa.has(p[chave])) mapa.set(p[chave], []);
    mapa.get(p[chave]).push(p);
  });
  return mapa;
}

// Pega a paleta de tons daquele segmento (cada segmento tem a sua, definida
// em config.js). Se algum segmento novo aparecer sem paleta cadastrada, cai
// de volta na paleta do Masculino (azul) só por segurança.
function paletaDoSegmento(segmento) {
  return CONFIG.paletasPorSegmento[segmento] || CONFIG.paletasPorSegmento.Masculino;
}

// A aba escolhida desliza sempre pro meio da barra, pra dar pra ver as
// abas de trás e as da frente — mesma regra já usada no Impala/Nadir.
// É assim também que dá pra "correr" a barra sem precisar arrastar: cada
// clique centraliza e revela as abas vizinhas.
function centralizarAbaAtiva(nav) {
  const ativa = nav.querySelector(".ativa");
  if (!ativa) return;
  const alvo = ativa.offsetLeft - (nav.clientWidth - ativa.clientWidth) / 2;
  nav.scrollTo({ left: Math.max(0, alvo), behavior: "smooth" });
}

// ---------- Abas de SEGMENTO (faixa fixa no topo) ----------
function renderAbasSegmento() {
  const nav = document.getElementById("abas-segmento");
  nav.innerHTML = "";

  SEGMENTO_ORDEM.forEach((segmento) => {
    if (!PRODUTOS_POR_SEGMENTO.has(segmento)) return; // segmento sem produto nenhum nesse vendedor
    const ativo = !BUSCA_ATIVA && segmento === SEGMENTO_ATUAL;
    const btn = document.createElement("button");
    btn.className = "aba-segmento" + (ativo ? " ativa" : "");
    btn.textContent = SEGMENTO_ROTULO[segmento] || segmento;
    if (ativo) btn.style.background = paletaDoSegmento(segmento)[0];
    btn.addEventListener("click", () => selecionarSegmento(segmento));
    nav.appendChild(btn);
  });
  centralizarAbaAtiva(nav);
}

function selecionarSegmento(segmento) {
  if (BUSCA_ATIVA) fecharBusca();
  SEGMENTO_ATUAL = segmento;
  const colecoes = agruparPor(PRODUTOS_POR_SEGMENTO.get(segmento) || [], "colecao");
  const nomesEmOrdem = ordenarColecoes(segmento, colecoes.keys());
  COLECAO_ATUAL = nomesEmOrdem.length ? nomesEmOrdem[0] : null;
  renderAbasSegmento();
  renderAbasColecao();
  renderLista();
}

// ---------- Abas de COLEÇÃO (do segmento selecionado) ----------
function renderAbasColecao() {
  const nav = document.getElementById("abas-colecao");
  nav.hidden = !!BUSCA_ATIVA;
  nav.innerHTML = "";
  if (!SEGMENTO_ATUAL) return;

  const porColecao = agruparPor(PRODUTOS_POR_SEGMENTO.get(SEGMENTO_ATUAL) || [], "colecao");
  const nomesEmOrdem = ordenarColecoes(SEGMENTO_ATUAL, porColecao.keys());
  nomesEmOrdem.forEach((colecao) => {
    const btn = document.createElement("button");
    btn.className = "aba-colecao" + (colecao === COLECAO_ATUAL ? " ativa" : "");
    btn.textContent = colecao;
    btn.addEventListener("click", () => selecionarColecao(colecao));
    nav.appendChild(btn);
  });
  centralizarAbaAtiva(nav);
}

function selecionarColecao(colecao) {
  COLECAO_ATUAL = colecao;
  renderAbasColecao();
  renderLista();
}

// ---------- Busca geral (todos os segmentos/coleções — por coleção, cor ou numeração) ----------
// O cliente pode procurar pelo nome da coleção, pela cor, ou pela
// numeração (inclusive abreviada: "31/2" acha qualquer numeração que
// comece com "31", então acha "31/32"). Todas as palavras digitadas
// precisam bater (uma busca com duas palavras funciona como um "E").
function unidadesDaBusca(busca) {
  const termos = normalizarTexto(busca).split(/\s+/).filter(Boolean);
  const resultado = [];

  PRODUTOS_POR_SEGMENTO.forEach((produtosDoSegmento, segmento) => {
    const porColecao = agruparPor(produtosDoSegmento, "colecao");
    porColecao.forEach((produtosDaColecao, colecao) => {
      const porCor = agruparPor(produtosDaColecao, "cor");
      porCor.forEach((numeracoes, cor) => {
        const textoBase = normalizarTexto(`${segmento} ${colecao} ${cor}`);
        const bate = termos.every((termo) => {
          if (textoBase.includes(termo)) return true;
          const comecaComDigitos = termo.match(/^(\d{2,})/);
          if (comecaComDigitos) {
            const prefixo = comecaComDigitos[1];
            return numeracoes.some((p) => String(p.numeracao).replace("/", "").startsWith(prefixo));
          }
          return false;
        });
        if (bate) resultado.push({ segmento, colecao, cor, numeracoes });
      });
    });
  });

  return resultado;
}

// ---------- Card de produto (1 card = 1 cor, com a grade de numerações) ----------
function criarCardProduto(unidade, mostrarContexto) {
  const { colecao, cor, numeracoes } = unidade;
  const primeiro = numeracoes[0];
  const rotuloPreco = primeiro.negociacao ? "Negociação" : formatarPreco(primeiro.preco);

  const card = document.createElement("article");
  card.className = "produto-card-grupo";
  card.innerHTML = `
    <div class="produto-info-topo">
      <h3 class="produto-cor-nome">${cor}</h3>
      <span class="produto-preco ${primeiro.negociacao ? "negociacao" : ""}">${rotuloPreco}</span>
    </div>
    ${mostrarContexto ? `<p class="produto-contexto">${unidade.segmento} · ${colecao}</p>` : ""}
    <div class="produto-corpo-grupo">
      <div class="produto-imagem-wrap-grupo">
        <img class="produto-imagem-grupo" src="${primeiro.imagem_url || ""}" alt="${cor}" loading="lazy" />
      </div>
      <div class="grade-numeracoes"></div>
    </div>
  `;

  card
    .querySelector(".produto-imagem-wrap-grupo")
    .addEventListener("click", () => abrirFotoAmpliada(primeiro.imagem_url));

  const gradeNumeracoes = card.querySelector(".grade-numeracoes");
  numeracoes.forEach((produto) => {
    const quantidadeAtual = carrinho.get(produto.codigo)?.quantidade || 0;

    const item = document.createElement("div");
    item.className = "numeracao-item";
    item.innerHTML = `
      <span class="numeracao-item-tam">${produto.numeracao}</span>
      <div class="qtd-seletor">
        <button class="qtd-btn qtd-menos" aria-label="Diminuir quantidade">−</button>
        <span class="qtd-valor">${quantidadeAtual}</span>
        <button class="qtd-btn qtd-mais" aria-label="Aumentar quantidade">+</button>
      </div>
    `;

    const qtdValorEl = item.querySelector(".qtd-valor");
    item.querySelector(".qtd-mais").addEventListener("click", () => {
      alterarQuantidade(produto, produto.fracao, qtdValorEl);
    });
    item.querySelector(".qtd-menos").addEventListener("click", () => {
      alterarQuantidade(produto, -produto.fracao, qtdValorEl);
    });

    gradeNumeracoes.appendChild(item);
  });

  return card;
}

// ---------- Renderiza a lista principal (aba normal OU resultado de busca) ----------
function renderLista() {
  const lista = document.getElementById("grade-produtos");
  const resumo = document.getElementById("busca-resumo");
  lista.innerHTML = "";

  let unidades;
  if (BUSCA_ATIVA) {
    unidades = unidadesDaBusca(BUSCA_ATIVA);
    resumo.hidden = false;
    resumo.textContent = `${unidades.length} ${unidades.length === 1 ? "cor encontrada" : "cores encontradas"} em todos os segmentos`;
  } else {
    resumo.hidden = true;
    if (!SEGMENTO_ATUAL || !COLECAO_ATUAL) {
      lista.innerHTML = `<p class="sem-itens">Nenhum item disponível.</p>`;
      return;
    }
    const produtosDaColecao = (PRODUTOS_POR_SEGMENTO.get(SEGMENTO_ATUAL) || []).filter(
      (p) => p.colecao === COLECAO_ATUAL
    );
    const porCor = agruparPor(produtosDaColecao, "cor");
    unidades = [...porCor.entries()].map(([cor, numeracoes]) => ({
      segmento: SEGMENTO_ATUAL,
      colecao: COLECAO_ATUAL,
      cor,
      numeracoes,
    }));
  }

  if (unidades.length === 0) {
    lista.innerHTML = `<p class="sem-itens">${BUSCA_ATIVA ? "Nenhuma cor encontrada." : "Nenhum item disponível."}</p>`;
    return;
  }

  const fragmento = document.createDocumentFragment();
  unidades.forEach((unidade) => fragmento.appendChild(criarCardProduto(unidade, !!BUSCA_ATIVA)));
  lista.appendChild(fragmento);
}

// ---------- Foto ampliada (toque na foto do produto) — igual ao Impala/Nadir ----------
function abrirFotoAmpliada(url) {
  document.getElementById("foto-zoom-img").src = url;
  document.getElementById("foto-zoom-fundo").hidden = false;
}

function fecharFotoAmpliada() {
  document.getElementById("foto-zoom-fundo").hidden = true;
  document.getElementById("foto-zoom-img").removeAttribute("src");
}

// ---------- Busca: abrir/fechar a barra ----------
function abrirBusca() {
  document.getElementById("barra-busca").classList.add("aberta");
  document.getElementById("btn-busca").classList.add("ativo");
  document.getElementById("campo-busca").focus();
}
function fecharBusca() {
  document.getElementById("barra-busca").classList.remove("aberta");
  document.getElementById("btn-busca").classList.remove("ativo");
  document.getElementById("campo-busca").value = "";
  BUSCA_ATIVA = "";
  renderAbasSegmento();
  renderAbasColecao();
  renderLista();
}

// ---------- Carrinho ----------
function alterarQuantidade(produto, delta, qtdValorEl) {
  const atual = carrinho.get(produto.codigo)?.quantidade || 0;
  const nova = Math.max(0, atual + delta);

  if (nova === 0) {
    carrinho.delete(produto.codigo);
  } else {
    carrinho.set(produto.codigo, { produto, quantidade: nova });
  }

  if (qtdValorEl) qtdValorEl.textContent = nova;
  atualizarContadorCarrinho();
  salvarCarrinhoNoCelular();
  // Ele continuou mexendo no carrinho depois de um envio anterior — esquece
  // aquele envio, pra pergunta "você já enviou?" não aparecer mais por ele.
  limparFlagEnviado();
}

// Atualiza o texto/estado da barra fixa "Ir para o carrinho" lá embaixo
// (substitui o antigo botão flutuante redondo).
function atualizarContadorCarrinho() {
  let total = 0;
  carrinho.forEach((item) => (total += item.quantidade));

  const btn = document.getElementById("btn-ir-carrinho");
  if (total === 0) {
    btn.disabled = true;
    btn.textContent = "Nenhum item selecionado";
  } else {
    btn.disabled = false;
    btn.textContent = `Ir para o carrinho (${total} ${total === 1 ? "item" : "itens"})`;
  }
}

// Soma só os itens de coleções COM preço definido — coleções em negociação
// entram no carrinho e no pedido com as quantidades, mas não somam valor.
function calcularTotalCarrinho() {
  let total = 0;
  carrinho.forEach((item) => {
    if (!item.produto.negociacao) {
      total += item.quantidade * Number(item.produto.preco);
    }
  });
  return total;
}

function temItemEmNegociacao() {
  for (const item of carrinho.values()) {
    if (item.produto.negociacao) return true;
  }
  return false;
}

// Comparador alfabético (ignora maiúsc./minúsc. e acentos) usado pra
// ordenar coleções e cores no carrinho e no texto do pedido.
function compararTexto(a, b) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

// Numeração tipo "37/38" -> 37, pra ordenar da menor pra maior.
function numeracaoParaOrdenacao(numeracao) {
  const primeiro = parseInt(numeracao, 10);
  return Number.isNaN(primeiro) ? 0 : primeiro;
}

// Agrupa os itens do carrinho por coleção, em ordem alfabética — mesma
// estrutura usada no painel do carrinho e no texto do pedido, pra ficar
// igual no app e no WhatsApp.
function agruparCarrinhoPorColecao() {
  const porColecao = new Map(); // colecao -> { produtoExemplo, itens: [{produto,quantidade}] }
  carrinho.forEach((item) => {
    const colecao = item.produto.colecao;
    if (!porColecao.has(colecao)) {
      porColecao.set(colecao, { exemplo: item.produto, itens: [] });
    }
    porColecao.get(colecao).itens.push(item);
  });

  const colecoesOrdenadas = [...porColecao.keys()].sort(compararTexto);
  const porColecaoOrdenada = new Map();
  colecoesOrdenadas.forEach((colecao) => porColecaoOrdenada.set(colecao, porColecao.get(colecao)));
  return porColecaoOrdenada;
}

// Agrupa os itens de uma coleção por cor, em ordem alfabética, e dentro de
// cada cor ordena as numerações da menor pra maior.
function agruparItensPorCor(itens) {
  const porCor = new Map();
  itens.forEach((item) => {
    const cor = item.produto.cor;
    if (!porCor.has(cor)) porCor.set(cor, []);
    porCor.get(cor).push(item);
  });

  const coresOrdenadas = [...porCor.keys()].sort(compararTexto);
  const porCorOrdenada = new Map();
  coresOrdenadas.forEach((cor) => {
    const itensDaCor = porCor
      .get(cor)
      .sort((a, b) => numeracaoParaOrdenacao(a.produto.numeracao) - numeracaoParaOrdenacao(b.produto.numeracao));
    porCorOrdenada.set(cor, itensDaCor);
  });
  return porCorOrdenada;
}

function renderizarPainelCarrinho() {
  const lista = document.getElementById("lista-carrinho");
  lista.innerHTML = "";

  if (carrinho.size === 0) {
    lista.innerHTML = `
      <div class="carrinho-vazio">
        <span class="carrinho-vazio-icone">👡</span>
        <p>Seu carrinho está vazio.<br>Escolha um segmento e adicione seus produtos!</p>
      </div>
    `;
  } else {
    const porColecao = agruparCarrinhoPorColecao();
    porColecao.forEach(({ exemplo, itens }, colecao) => {
      const grupoColecao = document.createElement("div");
      grupoColecao.className = "carrinho-grupo-colecao";
      grupoColecao.innerHTML = `
        <p class="carrinho-colecao-titulo">${colecao} <span class="carrinho-colecao-preco">${
        exemplo.negociacao ? "Negociação" : formatarPreco(exemplo.preco)
      }</span></p>
      `;

      const porCor = agruparItensPorCor(itens);
      porCor.forEach((itensDaCor) => {
        itensDaCor.forEach(({ produto, quantidade }) => {
          const linha = document.createElement("div");
          linha.className = "carrinho-item";
          linha.innerHTML = `
            <div class="carrinho-item-info">
              <p class="carrinho-item-nome">${produto.cor} · ${produto.numeracao}</p>
              <p class="carrinho-item-codigo">Cód. ${produto.codigo}</p>
            </div>
            <div class="qtd-seletor">
              <button class="qtd-btn qtd-menos" aria-label="Diminuir quantidade">−</button>
              <span class="qtd-valor">${quantidade}</span>
              <button class="qtd-btn qtd-mais" aria-label="Aumentar quantidade">+</button>
            </div>
          `;
          const qtdValorEl = linha.querySelector(".qtd-valor");
          linha.querySelector(".qtd-mais").addEventListener("click", () => {
            alterarQuantidade(produto, produto.fracao, qtdValorEl);
            renderizarPainelCarrinho();
          });
          linha.querySelector(".qtd-menos").addEventListener("click", () => {
            alterarQuantidade(produto, -produto.fracao, qtdValorEl);
            renderizarPainelCarrinho();
          });
          grupoColecao.appendChild(linha);
        });
      });

      lista.appendChild(grupoColecao);
    });
  }

  document.getElementById("carrinho-total-valor").textContent = formatarPreco(calcularTotalCarrinho());
  document.getElementById("carrinho-negociacao-aviso").hidden = !temItemEmNegociacao();
}

function limparCarrinho() {
  if (carrinho.size === 0) return;
  const confirmar = confirm("Excluir todos os itens do carrinho?");
  if (!confirmar) return;
  executarLimpezaCarrinho();
}

// ---------- Carrinho guardado no celular (localStorage) ----------
// Guardamos só código do produto + quantidade, separado por vendedor (pela
// "slug" do link), pra sobreviver a um F5/atualização de página ou o
// cliente saindo pra atender uma ligação e voltando depois. O preço nunca
// é guardado — ele sempre vem de novo da lista de produtos carregada na
// hora, então nunca fica desatualizado. Se o navegador estiver em modo
// privado ou sem espaço, qualquer leitura/escrita aqui falha em silêncio e
// o catálogo continua funcionando normal, só sem guardar nada.
function chaveStorageCarrinho() {
  return `hav_carrinho_v1_${SLUG_VENDEDOR_ATUAL || "sem-vendedor"}`;
}

function chaveStorageEnviado() {
  return `hav_carrinho_enviado_v1_${SLUG_VENDEDOR_ATUAL || "sem-vendedor"}`;
}

function salvarCarrinhoNoCelular() {
  try {
    const itens = [...carrinho.values()].map(({ produto, quantidade }) => ({
      codigo: produto.codigo,
      quantidade,
    }));
    localStorage.setItem(chaveStorageCarrinho(), JSON.stringify(itens));
  } catch (erro) {
    // Modo privado, sem espaço, etc. — ignora e segue só na memória.
  }
}

// Lê o carrinho salvo e recoloca os itens, buscando cada produto de novo em
// TODOS_PRODUTOS (já carregado com o preço/estoque de hoje). Um código
// salvo que não existe mais na lista atual (produto saiu do catálogo) é
// simplesmente ignorado — some do carrinho sozinho.
function restaurarCarrinhoDoCelular() {
  try {
    const salvo = localStorage.getItem(chaveStorageCarrinho());
    if (!salvo) return;
    const itens = JSON.parse(salvo);
    if (!Array.isArray(itens)) return;

    const mapaProdutos = new Map(TODOS_PRODUTOS.map((p) => [p.codigo, p]));
    itens.forEach(({ codigo, quantidade }) => {
      const produto = mapaProdutos.get(codigo);
      if (produto && quantidade > 0) {
        carrinho.set(codigo, { produto, quantidade });
      }
    });
  } catch (erro) {
    // Ignora e segue com o carrinho vazio, igual a um cliente novo.
  }
}

function marcarPedidoEnviado() {
  try {
    localStorage.setItem(chaveStorageEnviado(), String(Date.now()));
  } catch (erro) {
    // Sem espaço/modo privado — a pergunta pós-envio simplesmente não vai
    // aparecer depois; não afeta o envio em si.
  }
}

function limparFlagEnviado() {
  try {
    localStorage.removeItem(chaveStorageEnviado());
  } catch (erro) {
    // nada a fazer
  }
}

// Usada tanto pela lixeira (depois do confirm() nativo que já existia)
// quanto pelo "Sim, limpar" da caixinha pós-envio — limpa carrinho, tela e
// o que está guardado no celular, tudo junto.
function executarLimpezaCarrinho() {
  carrinho.clear();
  atualizarContadorCarrinho();
  renderizarPainelCarrinho();
  salvarCarrinhoNoCelular();
  limparFlagEnviado();
}

// Checa se faz sentido perguntar "você já enviou esses itens?" — só
// pergunta se: tem um envio registrado, já passaram pelo menos 4s dele (pra
// não disparar à toa se a tela "piscar" logo depois do clique de enviar) e
// ainda tem itens no carrinho pra perguntar sobre.
function verificarPerguntaReenvio() {
  try {
    const enviadoEm = localStorage.getItem(chaveStorageEnviado());
    if (!enviadoEm) return;

    const passados = Date.now() - Number(enviadoEm);
    if (Number.isNaN(passados) || passados < 4000) return;

    if (carrinho.size === 0) {
      limparFlagEnviado();
      return;
    }

    document.getElementById("modal-reenvio").hidden = false;
  } catch (erro) {
    // Sem localStorage disponível — não tem o que perguntar.
  }
}

function abrirCarrinho() {
  renderizarPainelCarrinho();
  mostrarTela("tela-carrinho");
}

function voltarDoCarrinho() {
  renderLista(); // sincroniza as quantidades mostradas nos cards, caso tenham mudado dentro do carrinho
  mostrarTela("tela-catalogo", "voltar");
}

// ---------- Envio do pedido pelo WhatsApp ----------
// Formato (negrito e citação são os próprios códigos de formatação do
// WhatsApp: *texto* = negrito, > no início da linha = bloco de citação):
//
// 📋 *Pedido Havaianas*
// Loja: [nome da loja]
//
// > *BRASIL - R$31,90*
// - *AZUL NAVAL*
// Cód: 1202477 | 33/34 | Qtd: 2
//
// > *TOP ADULTO - Negociação*
// - *AMARELO POP*
// Cód: 1221317 | 33/34 | Qtd: 2
//
// *TOTAL DO PEDIDO: R$95,70*
function montarTextoPedido() {
  const nomeLoja = document.getElementById("input-loja").value.trim();
  const linhas = [`📋 *Pedido ${CONFIG.nomeCatalogo}*`, `Loja: ${nomeLoja || "Não informada"}`, ""];

  const porColecao = agruparCarrinhoPorColecao();
  porColecao.forEach(({ exemplo, itens }, colecao) => {
    const rotulo = exemplo.negociacao ? "Negociação" : formatarPreco(exemplo.preco);
    linhas.push(`> *${colecao.toUpperCase()} - ${rotulo}*`);

    const porCor = agruparItensPorCor(itens);

    porCor.forEach((itensDaCor, cor) => {
      linhas.push(`- *${cor.toUpperCase()}*`);
      itensDaCor.forEach(({ produto, quantidade }) => {
        linhas.push(`Cód: ${produto.codigo} | ${produto.numeracao} | Qtd: ${quantidade}`);
      });
    });

    linhas.push("");
  });

  linhas.push(`*TOTAL DO PEDIDO: ${formatarPreco(calcularTotalCarrinho())}*`);
  if (temItemEmNegociacao()) {
    linhas.push(`_(itens em negociação não entram nesse total)_`);
  }
  return linhas.join("\n");
}

function enviarPedidoWhatsapp() {
  if (carrinho.size === 0) {
    alert("Adicione pelo menos um produto antes de enviar o pedido.");
    return;
  }
  const whatsappVendedor = VENDEDOR_ATUAL?.whatsapp;
  if (!whatsappVendedor) {
    alert("Não conseguimos identificar o WhatsApp deste vendedor. Recarregue a página e tente novamente.");
    return;
  }
  const texto = encodeURIComponent(montarTextoPedido());
  const url = `https://wa.me/${whatsappVendedor}?text=${texto}`;
  window.open(url, "_blank");
  marcarPedidoEnviado();
}

// ---------- Tela de pausado (assinatura em atraso) ----------
function configurarBotaoPausado() {
  const btn = document.getElementById("btn-pausado-whatsapp");
  const texto = encodeURIComponent(
    `Olá! Meu catálogo (${CONFIG.nomeCatalogo}) está pausado, gostaria de regularizar o acesso.`
  );
  btn.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Tela de "catálogo não encontrado" (link inválido/desconhecido) ----------
function configurarBotaoNaoEncontrado() {
  const btn = document.getElementById("btn-nao-encontrado-whatsapp");
  const texto = encodeURIComponent(
    `Olá! Abri um link de catálogo Havaianas (${window.location.href}) e apareceu "não encontrado". Pode me ajudar?`
  );
  btn.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Boot ----------
async function iniciar() {
  iniciarCabecalhoMarca();

  const carregando = document.getElementById("carregando-app");

  // 1) Descobre QUEM é o vendedor (via ?v= ou domínio antigo)
  const vendedorId = await resolverVendedorId();
  SLUG_VENDEDOR_ATUAL = vendedorId;
  if (!vendedorId) {
    carregando.hidden = true;
    configurarBotaoNaoEncontrado();
    mostrarTela("tela-nao-encontrado");
    return;
  }
  registrarAcesso(vendedorId);

  // 2) Busca os dados desse vendedor no Supabase
  const statusVendedor = await buscarStatusVendedor(vendedorId);
  if (!statusVendedor.encontrado) {
    carregando.hidden = true;
    configurarBotaoNaoEncontrado();
    mostrarTela("tela-nao-encontrado");
    return;
  }

  VENDEDOR_ATUAL = statusVendedor;
  preencherCabecalhoVendedor(statusVendedor);

  if (!statusVendedor.ativo) {
    carregando.hidden = true;
    configurarBotaoPausado();
    mostrarTela("tela-pausado");
    return;
  }

  const statusMsg = document.getElementById("status-msg");
  statusMsg.hidden = false;
  statusMsg.innerHTML = `<span class="spinner"></span> Carregando catálogo...`;

  TODOS_PRODUTOS = await buscarProdutos(statusVendedor.area);
  PRODUTOS_POR_SEGMENTO = agruparPor(TODOS_PRODUTOS, "segmento");

  // Recupera o carrinho guardado no celular desse vendedor, se tiver.
  restaurarCarrinhoDoCelular();
  atualizarContadorCarrinho();

  statusMsg.hidden = true;
  renderAbasSegmento();
  const primeiroSegmento = SEGMENTO_ORDEM.find((s) => PRODUTOS_POR_SEGMENTO.has(s));
  if (primeiroSegmento) selecionarSegmento(primeiroSegmento);

  document.getElementById("btn-ir-carrinho").addEventListener("click", abrirCarrinho);
  document.getElementById("btn-voltar-carrinho").addEventListener("click", voltarDoCarrinho);
  document.getElementById("btn-enviar-pedido").addEventListener("click", enviarPedidoWhatsapp);
  document.getElementById("btn-limpar-carrinho").addEventListener("click", limparCarrinho);

  // Busca geral
  document.getElementById("btn-busca").addEventListener("click", () => {
    document.getElementById("barra-busca").classList.contains("aberta") ? fecharBusca() : abrirBusca();
  });
  document.getElementById("fechar-busca").addEventListener("click", fecharBusca);

  // Foto ampliada (toque na foto do produto)
  document.getElementById("foto-zoom-fundo").addEventListener("click", (e) => {
    if (e.target.id === "foto-zoom-fundo" || e.target.id === "foto-zoom-fechar") fecharFotoAmpliada();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("foto-zoom-fundo").hidden) fecharFotoAmpliada();
  });
  document.getElementById("campo-busca").addEventListener("input", (e) => {
    BUSCA_ATIVA = e.target.value.trim();
    renderAbasSegmento();
    renderAbasColecao();
    renderLista();
  });

  // Caixinha "você já enviou esses itens?" — some depois de respondida.
  document.getElementById("btn-reenvio-limpar").addEventListener("click", () => {
    executarLimpezaCarrinho();
    document.getElementById("modal-reenvio").hidden = true;
  });
  document.getElementById("btn-reenvio-manter").addEventListener("click", () => {
    limparFlagEnviado();
    document.getElementById("modal-reenvio").hidden = true;
  });
  // Cobre tanto quando o navegador recarrega a página (ex: Android, depois
  // de voltar do WhatsApp) quanto quando ele só troca de aba/app e volta
  // sem recarregar nada (ex: iPhone) — nos dois casos checa se é hora de
  // perguntar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verificarPerguntaReenvio();
  });

  carregando.hidden = true;
  mostrarTela("tela-catalogo");
  verificarPerguntaReenvio();

  // Tour guiado: tocar na foto do vendedor abre o passo a passo; na 1ª
  // visita naquele celular aparece a dica "Toque na minha foto...".
  iniciarTourGuiado();
}

// ============================================================
// TOUR GUIADO (toque na foto do vendedor)
// ============================================================
// O próprio vendedor "explica" o catálogo: a tela escurece, só o item da vez
// fica aceso, e um balão de fala com a fotinha dele explica pra que serve.
// Pensado pro cliente final (o link é o mesmo pra cliente e vendedor).
// - Abre a qualquer momento tocando na foto do vendedor (tem um "?" no canto).
// - Na 1ª visita naquele celular, aparece só uma dica "Toque na minha foto e
//   eu te mostro como funciona" — ela some no 1º toque e não volta mais.
// O tour não mexe no carrinho nem em nada do catálogo: só mostra e explica.
const CHAVE_DICA_FOTO = "havaianas-dica-foto-vista";
let TOUR_ATIVO = false;
let TOUR_PASSO = 0;
let TOUR_PASSOS = [];
let DICA_FOTO_ABERTA = false;

function tourLerStorage(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
function tourGravarStorage(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* modo privado: segue sem guardar */ } }

function primeiroNomeVendedor() {
  const nome = (VENDEDOR_ATUAL && VENDEDOR_ATUAL.nome) || document.getElementById("vendedor-nome").textContent || "";
  return String(nome).trim().split(/\s+/)[0] || "seu vendedor";
}

// Os 7 passos — textos na voz do vendedor (sem "o"/"a" antes do nome, pra
// servir pra vendedor e vendedora). No Havaianas são 2 fileiras de abas
// (público e coleção), não tem botão de ordenar, e cada card é uma cor com
// as numerações — aprovados pelo Leonardo em 14/11/2026.
function montarPassosTour() {
  return [
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Oi! Eu sou <b>${escaparHtml(primeiroNomeVendedor())}</b> e vou te mostrar rapidinho como fazer seu pedido aqui.`,
    },
    {
      alvo: () => document.getElementById("abas-segmento"),
      texto: () => `Primeiro escolha o <b>público</b>: Unissex, Masculino, Feminino, Kids ou Licenciados.`,
    },
    {
      alvo: () => document.getElementById("abas-colecao"),
      texto: () => `Depois escolha a <b>coleção</b>. Arraste pro lado para ver todas.`,
    },
    {
      alvo: () => document.getElementById("btn-busca").closest(".acao-cabecalho"),
      texto: () => `Procurando algo? Toque na <b>lupa</b> e busque pela coleção, pela cor ou pela numeração (ex: 37/38).`,
    },
    {
      alvo: () => document.querySelector("#grade-produtos .produto-card-grupo"),
      texto: () => `Cada card é uma <b>cor</b>. Toque no <b>+</b> da numeração que você quer para somar os pares. Em alguns modelos o + soma de 2 ou de 6 pares. Toque na foto para ver maior.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Aqui embaixo você acompanha quantos itens já escolheu. Sua seleção fica <b>guardada</b>, mesmo se você fechar a página.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Quando terminar, toque aqui para ver seu <b>carrinho</b> e me enviar o pedido.`,
    },
  ];
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Dica de 1ª visita ----------
function posicionarDicaFoto() {
  const dica = document.getElementById("dica-foto");
  const r = document.getElementById("vendedor-foto-wrap").getBoundingClientRect();
  const left = Math.max(10, r.left - 4);
  dica.style.left = left + "px";
  dica.style.top = (r.bottom + 12) + "px";
  dica.style.setProperty("--seta-x", (r.left + r.width / 2 - left) + "px");
}

function mostrarDicaFoto() {
  // Não atrapalha se já tem outra coisa na frente (tour, pergunta, foto ampliada)
  if (TOUR_ATIVO || document.getElementById("tela-catalogo").hidden) return;
  if (!document.getElementById("modal-reenvio").hidden || !document.getElementById("foto-zoom-fundo").hidden) return;
  posicionarDicaFoto();
  document.getElementById("dica-foto").classList.add("visivel");
  document.getElementById("vendedor-foto-wrap").classList.add("pulsando");
  DICA_FOTO_ABERTA = true;
}

function esconderDicaFoto() {
  if (!DICA_FOTO_ABERTA) return;
  DICA_FOTO_ABERTA = false;
  document.getElementById("dica-foto").classList.remove("visivel");
  document.getElementById("vendedor-foto-wrap").classList.remove("pulsando");
  tourGravarStorage(CHAVE_DICA_FOTO, "1");
}

// ---------- Tour ----------
// Mini tour da tela do carrinho (foto do vendedor ao lado do "Enviar").
// Decisões do Leonardo em 14/11/2026: 5 passos (+1 sobre "itens a negociar",
// só quando tem item em negociação), sem dica de 1ª visita aqui
// (o "?" na foto basta, porque o cliente já aprendeu na tela principal).
function montarPassosTourCarrinho() {
  return [
    {
      alvo: () => document.querySelector("#lista-carrinho .carrinho-item .qtd-seletor"),
      texto: () => `Aqui você ajusta as <b>quantidades</b>. Se tirar tudo no <b>−</b>, o item sai do pedido.`,
    },
    {
      alvo: () => document.getElementById("btn-limpar-carrinho"),
      texto: () => `Quer recomeçar? Aqui você <b>apaga tudo</b> de uma vez.`,
    },
    {
      alvo: () => document.querySelector("#tela-carrinho .carrinho-loja"),
      texto: () => `Tem mais de uma loja? Escreva aqui <b>para qual loja</b> é o pedido.`,
    },
    {
      alvo: () => document.getElementById("btn-pdf-pedido"),
      texto: () => `Aqui você baixa seu pedido em <b>PDF</b>, se preferir.`,
    },
    {
      // Só aparece se tiver item em "Negociação" no carrinho
      alvo: () => {
        const aviso = document.getElementById("carrinho-negociacao-aviso");
        return aviso && !aviso.hidden ? aviso : null;
      },
      texto: () => `Itens em <b>negociação</b> não entram no total. O preço a gente acerta pelo WhatsApp.`,
    },
    {
      alvo: () => document.getElementById("btn-enviar-pedido"),
      texto: () => `Tudo certo? Toque aqui e seu pedido chega direto no meu <b>WhatsApp</b>.`,
    },
  ];
}

function iniciarTour() {
  esconderDicaFoto();
  if (TOUR_ATIVO) return;
  // Deixa a tela "limpa" antes de começar: sem busca, sem menu, lá no topo
  if (BUSCA_ATIVA || document.getElementById("barra-busca").classList.contains("aberta")) fecharBusca();
  window.scrollTo(0, 0);
  abrirTour(montarPassosTour());
}

function iniciarTourCarrinho() {
  if (TOUR_ATIVO) return;
  window.scrollTo(0, 0);
  abrirTour(montarPassosTourCarrinho());
}

function abrirTour(passos) {
  // Pula passos cujo item não existe na tela (ex: coleção sem produto,
  // carrinho vazio)
  TOUR_PASSOS = passos.filter((p) => {
    const alvo = p.alvo();
    return Array.isArray(alvo) ? alvo.length > 0 : !!alvo;
  });
  if (TOUR_PASSOS.length === 0) return;

  TOUR_ATIVO = true;
  TOUR_PASSO = 0;
  document.getElementById("tour-nome").textContent = primeiroNomeVendedor();
  document.getElementById("tour-mini-foto").src = document.getElementById("vendedor-foto").src;
  document.getElementById("tour-bloqueio").hidden = false;
  document.getElementById("tour-destaque").hidden = false;
  document.getElementById("tour-balao").hidden = false;
  mostrarPassoTour();
}

function encerrarTour() {
  TOUR_ATIVO = false;
  document.getElementById("tour-bloqueio").hidden = true;
  document.getElementById("tour-destaque").hidden = true;
  document.getElementById("tour-balao").hidden = true;
  simularBotaoCarrinho(false);
}

// Nos passos do carrinho, com nada marcado, o botão aparece como
// "Ir para o carrinho" em vez do cinza "Nenhum item selecionado" (decisão
// do Leonardo). Ao sair do passo/tour, volta ao normal.
function simularBotaoCarrinho(ligar) {
  const btn = document.getElementById("btn-ir-carrinho");
  if (ligar && btn.disabled) {
    btn.classList.add("tour-simulado");
    btn.textContent = "Ir para o carrinho";
  } else if (!ligar && btn.classList.contains("tour-simulado")) {
    btn.classList.remove("tour-simulado");
    atualizarContadorCarrinho();
  }
}

function mostrarPassoTour() {
  const passo = TOUR_PASSOS[TOUR_PASSO];
  const ultimo = TOUR_PASSO === TOUR_PASSOS.length - 1;
  simularBotaoCarrinho(!!passo.botaoCarrinho);
  document.getElementById("tour-texto").innerHTML = passo.texto();
  document.getElementById("tour-contador").textContent = `${TOUR_PASSO + 1} de ${TOUR_PASSOS.length}`;
  document.getElementById("tour-proximo").textContent = ultimo ? "Entendi! 👍" : "Próximo →";
  document.getElementById("tour-pular").style.visibility = ultimo ? "hidden" : "visible";
  posicionarPassoTour();
}

function posicionarPassoTour() {
  if (!TOUR_ATIVO) return;
  const passo = TOUR_PASSOS[TOUR_PASSO];
  const el = passo.alvo();
  if (!el) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const destaque = document.getElementById("tour-destaque");

  // Passo sem item pra apontar: tela escurecida e balão no meio
  if (passo.centro) {
    destaque.classList.add("sem-anel");
    Object.assign(destaque.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px" });
    const balaoC = document.getElementById("tour-balao");
    const caixaC = document.getElementById("tour-caixa");
    const larguraC = Math.min(360, vw - 24);
    balaoC.style.width = larguraC + "px";
    caixaC.classList.remove("seta-cima", "seta-baixo");
    caixaC.classList.add("sem-seta");
    balaoC.style.left = (vw - larguraC) / 2 + "px";
    balaoC.style.top = Math.max(10, (vh - balaoC.offsetHeight) / 2) + "px";
    return;
  }
  destaque.classList.remove("sem-anel");
  document.getElementById("tour-caixa").classList.remove("sem-seta");

  // O alvo pode ser um item só ou uma lista (ex: botões PDF + Imagem juntos)
  let r;
  if (Array.isArray(el)) {
    const rs = el.map((e) => e.getBoundingClientRect());
    const left = Math.min(...rs.map((x) => x.left));
    const top = Math.min(...rs.map((x) => x.top));
    const right = Math.max(...rs.map((x) => x.right));
    const bottom = Math.max(...rs.map((x) => x.bottom));
    r = { left, top, right, bottom, width: right - left, height: bottom - top };
  } else {
    r = el.getBoundingClientRect();
  }

  // Recorte iluminado em volta do item
  let dl, dt, dw, dh;
  if (passo.redondo) {
    const lado = Math.max(r.width, r.height) + pad * 2;
    dl = r.left + r.width / 2 - lado / 2;
    dt = r.top + r.height / 2 - lado / 2;
    dw = dh = lado;
    destaque.style.borderRadius = "50%";
  } else {
    dl = r.left - pad;
    dt = r.top - pad;
    dw = r.width + pad * 2;
    dh = r.height + pad * 2;
    destaque.style.borderRadius = "14px";
  }
  Object.assign(destaque.style, { left: dl + "px", top: dt + "px", width: dw + "px", height: dh + "px" });

  // Balão: embaixo do item se couber, senão em cima
  const balao = document.getElementById("tour-balao");
  const caixa = document.getElementById("tour-caixa");
  const largura = Math.min(360, vw - 24);
  const recuoCaixa = 46 + 8; // fotinha + espaço até o balão de fala
  balao.style.width = largura + "px";
  const altura = balao.offsetHeight;
  const espacoAbaixo = vh - (dt + dh);
  let top;
  caixa.classList.remove("seta-cima", "seta-baixo");
  if (espacoAbaixo > altura + 24) {
    top = dt + dh + 14;
    caixa.classList.add("seta-cima");
  } else {
    top = Math.max(10, dt - altura - 14);
    caixa.classList.add("seta-baixo");
  }
  const centroX = dl + dw / 2;
  const larguraCaixa = largura - recuoCaixa;
  const left = Math.min(Math.max(12, centroX - recuoCaixa - larguraCaixa / 2), vw - largura - 12);
  balao.style.left = left + "px";
  balao.style.top = top + "px";
  caixa.style.setProperty("--seta-x", Math.min(Math.max(18, centroX - left - recuoCaixa), larguraCaixa - 22) + "px");
}

// Liga tudo — chamado no fim do iniciar(), quando o catálogo já está na tela
function iniciarTourGuiado() {
  const ligarFoto = (el, acao) => {
    el.addEventListener("click", acao);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acao(); }
    });
  };
  ligarFotoComToqueEscondido(document.getElementById("vendedor-foto-wrap"));
  ligarFoto(document.getElementById("carrinho-foto-wrap"), iniciarTourCarrinho);
  ligarMenuVendedor();
  // A foto do carrinho é a mesma do cabeçalho (já carregada a esta altura)
  document.getElementById("carrinho-foto").src = document.getElementById("vendedor-foto").src;
  document.getElementById("tour-pular").addEventListener("click", encerrarTour);
  document.getElementById("tour-proximo").addEventListener("click", () => {
    if (TOUR_PASSO >= TOUR_PASSOS.length - 1) { encerrarTour(); return; }
    TOUR_PASSO++;
    mostrarPassoTour();
  });
  window.addEventListener("resize", () => {
    posicionarPassoTour();
    if (DICA_FOTO_ABERTA) posicionarDicaFoto();
  });
  // Qualquer toque na tela já some com a dica de 1ª visita
  document.addEventListener("pointerdown", esconderDicaFoto, true);

  if (!tourLerStorage(CHAVE_DICA_FOTO)) setTimeout(mostrarDicaFoto, 900);
}


// ============================================================
// MENU DO VENDEDOR (toque escondido) + TUTORIAL DO VENDEDOR
// ============================================================
// Ideia do Leonardo (14/11/2026): o link é o mesmo pra cliente e vendedor,
// então o "modo vendedor" abre por um toque escondido: SEGURAR a foto do
// vendedor por 3 segundos (um anel dourado vai enchendo). Abre um menu com
// "Copiar meu link" (o vendedor não perde mais o próprio link) e
// "Tutorial do vendedor". Toque rápido na foto continua abrindo o tour do
// cliente. Soltou antes dos 3s (depois de um toque longo)? Não acontece nada.
const TEMPO_SEGURAR_MS = 3000;
const TOQUE_RAPIDO_MS = 600;

function ligarFotoComToqueEscondido(foto) {
  let timer = null;
  let inicio = 0;
  let abriuMenu = false;
  let xIni = 0;
  let yIni = 0;

  const cancelar = () => {
    clearTimeout(timer);
    timer = null;
    foto.classList.remove("segurando");
  };

  foto.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    abriuMenu = false;
    inicio = Date.now();
    xIni = e.clientX;
    yIni = e.clientY;
    foto.classList.add("segurando");
    timer = setTimeout(() => {
      timer = null;
      abriuMenu = true;
      foto.classList.remove("segurando");
      try { if (navigator.vibrate) navigator.vibrate(40); } catch (erro) { /* sem vibração */ }
      abrirMenuVendedor();
    }, TEMPO_SEGURAR_MS);
  });

  // Arrastou o dedo (rolando a tela)? Cancela.
  foto.addEventListener("pointermove", (e) => {
    if (timer && Math.hypot(e.clientX - xIni, e.clientY - yIni) > 12) cancelar();
  });

  foto.addEventListener("pointerup", () => {
    const foiRapido = timer && Date.now() - inicio < TOQUE_RAPIDO_MS;
    cancelar();
    if (foiRapido && !abriuMenu) iniciarTour();
  });
  foto.addEventListener("pointercancel", cancelar);
  foto.addEventListener("pointerleave", () => { if (timer) cancelar(); });

  // Segurar a foto não pode abrir o menu do navegador ("Salvar imagem" etc)
  foto.addEventListener("contextmenu", (e) => e.preventDefault());

  // Teclado: Enter/espaço abre o tour do cliente
  foto.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); iniciarTour(); }
  });
}

function posicionarMenuVendedor() {
  const menu = document.getElementById("menu-vendedor");
  const r = document.getElementById("vendedor-foto-wrap").getBoundingClientRect();
  const largura = menu.offsetWidth || 230;
  const left = Math.min(Math.max(10, r.left - 4), window.innerWidth - largura - 10);
  menu.style.left = left + "px";
  menu.style.top = (r.bottom + 14) + "px";
  menu.style.setProperty("--seta-x", (r.left + r.width / 2 - left) + "px");
}

function abrirMenuVendedor() {
  esconderDicaFoto();
  if (TOUR_ATIVO) return;
  window.scrollTo(0, 0);
  document.getElementById("menu-vendedor-fundo").hidden = false;
  document.getElementById("menu-vendedor").hidden = false;
  posicionarMenuVendedor();
}

function fecharMenuVendedor() {
  document.getElementById("menu-vendedor-fundo").hidden = true;
  document.getElementById("menu-vendedor").hidden = true;
}

let TIMER_AVISO_VENDEDOR = null;
function mostrarAvisoVendedor(texto, ms = 2600) {
  const aviso = document.getElementById("aviso-vendedor");
  aviso.textContent = texto;
  aviso.classList.add("mostrar");
  clearTimeout(TIMER_AVISO_VENDEDOR);
  TIMER_AVISO_VENDEDOR = setTimeout(() => aviso.classList.remove("mostrar"), ms);
}

// O link copiado é o MESMO link que o cliente usa (o link normal do
// vendedor, com o ?v= dele) — não existe link especial de vendedor.
function linkDoVendedor() {
  return window.location.href.split("#")[0];
}

async function copiarLinkDoVendedor() {
  const link = linkDoVendedor();
  let copiou = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      copiou = true;
    }
  } catch (erro) { /* tenta o jeito antigo abaixo */ }
  if (!copiou) {
    try {
      const campo = document.createElement("textarea");
      campo.value = link;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      copiou = document.execCommand("copy");
      campo.remove();
    } catch (erro) { copiou = false; }
  }
  fecharMenuVendedor();
  if (copiou) {
    mostrarAvisoVendedor("Link copiado! Agora é só colar no WhatsApp.");
  } else {
    // Celular não deixou copiar sozinho: mostra o link pra copiar à mão
    mostrarAvisoVendedor("Seu link: " + link, 8000);
  }
}

function eIphone() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// Os 6 passos do tutorial do vendedor — mesmos textos nos 5 catálogos
// (aprovados pelo Leonardo em 14/11/2026).
function montarPassosTourVendedor() {
  const salvarTela = eIphone()
    ? `No <b>Safari</b>, toque em <b>Compartilhar</b> (o quadradinho com a setinha ↑) e escolha <b>Adicionar à Tela de Início</b>. Assim seu catálogo fica no celular, com o ícone dele, e você nunca perde seu link!`
    : `No navegador, toque nos <b>3 pontinhos ⋮</b> lá em cima e escolha <b>Adicionar à tela inicial</b> (ou <b>Instalar app</b>). Assim seu catálogo fica no celular, com o ícone dele, e você nunca perde seu link!`;
  return [
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Oi, <b>${escaparHtml(primeiroNomeVendedor())}</b>! Este é o seu <b>modo vendedor</b>, com dicas só pra você. Seus clientes não veem isso.`,
    },
    {
      alvo: () => [document.getElementById("btn-exportar-pdf-ofertas"), document.getElementById("btn-exportar-imagem-ofertas")]
        .map((b) => b && b.closest(".acao-cabecalho")).filter(Boolean),
      texto: () => `Escolha os produtos que quer oferecer e toque em <b>PDF</b> ou <b>Imagem</b>. Sai pronto, com a sua foto e os preços, pra mandar aos clientes. A <b>Imagem</b> cabe até <b>16 produtos</b>; no <b>PDF</b> você coloca quantos quiser.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Tem cliente que faz o pedido pelo <b>computador</b> e não tem o WhatsApp aberto ali? Oriente ele a usar o botão <b>PDF do pedido</b>, dentro do carrinho: ele baixa o pedido e te manda por onde for mais fácil.`,
    },
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Sempre que precisar do seu link, <b>segure a sua foto</b> e toque em <b>Copiar meu link</b>. Aí é só colar no WhatsApp.`,
    },
    {
      alvo: () => document.body, centro: true,
      texto: () => salvarTela,
    },
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Seus clientes aprendem a usar o catálogo <b>tocando na sua foto</b>. Avise eles!`,
    },
  ];
}

function iniciarTourVendedor() {
  fecharMenuVendedor();
  if (TOUR_ATIVO) return;
  if (BUSCA_ATIVA || document.getElementById("barra-busca").classList.contains("aberta")) fecharBusca();
  window.scrollTo(0, 0);
  abrirTour(montarPassosTourVendedor());
}

function ligarMenuVendedor() {
  document.getElementById("btn-copiar-link").addEventListener("click", copiarLinkDoVendedor);
  document.getElementById("btn-tour-vendedor").addEventListener("click", iniciarTourVendedor);
  document.getElementById("btn-fechar-menu-vendedor").addEventListener("click", fecharMenuVendedor);
  document.getElementById("menu-vendedor-fundo").addEventListener("click", fecharMenuVendedor);
  window.addEventListener("resize", () => {
    if (!document.getElementById("menu-vendedor").hidden) posicionarMenuVendedor();
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
