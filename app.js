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
}

document.addEventListener("DOMContentLoaded", iniciar);
