// ============================================================
// GERAR PDF / IMAGEM DO CARRINHO — tela inicial da Havaianas
// ============================================================
// Mesma lógica/visual já usada e aprovada no Impala e no Nadir (molde de
// fundo A4 + grade de cartões desenhada por cima), adaptada aqui pro
// template e pras características da Havaianas.
//
// Diferença importante em relação ao Impala/Nadir: aqui um "produto" na
// tela de navegação é uma COR (várias numerações compartilhando a mesma
// foto — ver criarCardProduto/aplicarFotoDoGrupo). Então, diferente dos
// outros catálogos (1 cartão = 1 item do carrinho), aqui 1 cartão da
// Imagem/PDF = 1 grupo coleção+cor (a "vitrine" do produto), sem repetir
// a mesma foto uma vez pra cada numeração escolhida — isso é só uma peça
// de propaganda/mostruário pro cliente, não um recibo (quem mostra
// numeração e quantidade linha a linha é o "PDF do pedido", mais abaixo).
// O preço também não tem a distinção "un."/"cx" do Nadir — aqui é sempre
// por PAR, ou "Negociação" quando a coleção não tem preço fechado.

const EXPORT_TEMPLATE_CAMINHO = "template-havaianas.jpg";
const EXPORT_TEMPLATE_LARGURA = 1414;
const EXPORT_TEMPLATE_ALTURA = 2000;
// A Imagem é desenhada numa resolução mais alta que o tamanho final do
// molde (e depois reduzida de volta na hora de desenhar), só pra deixar o
// texto mais nítido — o PDF é vetorial (sempre nítido, em qualquer zoom),
// a Imagem é um raster então precisa de mais pixels reais pra ficar à
// altura.
const EXPORT_PNG_ESCALA = 2;
// Área em branco do molde da Havaianas onde a grade de cartões pode ser
// desenhada sem cobrir a moldura colorida de chinelos nem a logo
// "havaianas" (medida direto no arquivo enviado pelo Leonardo: moldura
// de fotos ocupa as bordas, o retângulo branco interno vai de x:34-1374 e
// y:123-1970, a logo do topo termina perto de y:120).
const EXPORT_TEMPLATE_AREA = { esq: 46, dir: 1362, topo: 150, base: 1958 };
// Faixa do topo, à ESQUERDA da logo "havaianas" (que fica centralizada e
// começa por volta de x:326) — mesmo padrão usado no Impala e no Nadir:
// foto + nome do vendedor sempre do lado esquerdo, nunca do direito.
const EXPORT_VENDEDOR_FOTO_X = 58;
const EXPORT_VENDEDOR_FOTO_Y_CENTRO = 68;
const EXPORT_VENDEDOR_FOTO_DIAMETRO = 56;
// Onde a logo "havaianas" começa (medido no arquivo) — usado só pra saber
// até onde o nome do vendedor pode esticar antes de encostar nela.
const EXPORT_VENDEDOR_LOGO_INICIO_X = 326;
// A altura de cada cartão da Imagem é calculada a partir do conteúdo
// (foto + nome da cor + coleção + etiqueta de preço), igual já é feito no
// PDF — em vez de dividir o espaço disponível em fileiras fixas.
//
// Só a FONTE da Imagem segue a mesma escala do PDF (pedido do Leonardo —
// o PDF é a referência de fonte). O espaçamento/proporção do cartão (pad,
// folgas, altura da etiqueta, formato da foto, gutter) continua igual ao
// que já era na Imagem antes, pra manter os 16 produtos por página.
const EXPORT_GRADE_PADCARD = 10;
const EXPORT_GRADE_GAP_FOTO_NOME = 20; // folga acima do bloco de texto
const EXPORT_GRADE_GAP_NOME_COLECAO = 16;
const EXPORT_GRADE_GAP_COLECAO_BADGE = 14;
const EXPORT_GRADE_LINHA_ALTURA_NOME = 18;
const EXPORT_GRADE_MAX_LINHAS_NOME = 2;
const EXPORT_GRADE_ALTURA_BADGE = 52;
// A foto do cartão fica um pouco mais baixa que larga (em vez de
// quadrada) — proporção própria da Imagem, independente do PDF.
const EXPORT_GRADE_FATOR_ALTURA_FOTO = 0.93;
// Fator da foto no PDF (só usado lá — a Imagem tem o seu próprio acima).
const EXPORT_PDF_FATOR_ALTURA_FOTO = 0.84;
// Azul da marca Havaianas (igual à corPrimaria do app) pra etiqueta de
// preço e nome do vendedor; dourado (igual ao anel da foto do vendedor no
// cabeçalho do próprio app) pro anel da foto aqui também.
const EXPORT_COR_BADGE = "#0A4595";
const EXPORT_COR_NOME_VENDEDOR = "#0A4595";
const EXPORT_COR_ANEL_VENDEDOR = "#d4af37";

// ---------- Helpers de desenho (mesmos do Impala/Nadir) ----------
function exportarDesenharRetanguloArredondado(ctx, x, y, largura, altura, raio) {
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + largura - raio, y);
  ctx.arcTo(x + largura, y, x + largura, y + raio, raio);
  ctx.lineTo(x + largura, y + altura - raio);
  ctx.arcTo(x + largura, y + altura, x + largura - raio, y + altura, raio);
  ctx.lineTo(x + raio, y + altura);
  ctx.arcTo(x, y + altura, x, y + altura - raio, raio);
  ctx.lineTo(x, y + raio);
  ctx.arcTo(x, y, x + raio, y, raio);
  ctx.closePath();
}

function exportarDesenharImagemPreenchendo(ctx, img, x, y, largura, altura) {
  const razaoAlvo = largura / altura;
  const razaoFoto = img.width / img.height;
  let sx = 0, sy = 0, sLargura = img.width, sAltura = img.height;
  if (razaoFoto > razaoAlvo) {
    sLargura = img.height * razaoAlvo;
    sx = (img.width - sLargura) / 2;
  } else {
    sAltura = img.width / razaoAlvo;
    sy = (img.height - sAltura) / 2;
  }
  ctx.drawImage(img, sx, sy, sLargura, sAltura, x, y, largura, altura);
}

function exportarQuebrarTextoCanvas(ctx, texto, larguraMax, maxLinhas) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let linhaAtual = "";
  palavras.forEach((palavra) => {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMax && linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = tentativa;
    }
  });
  if (linhaAtual) linhas.push(linhaAtual);
  if (linhas.length === 0) return [""];
  if (linhas.length > maxLinhas) {
    const cortadas = linhas.slice(0, maxLinhas);
    let ultima = cortadas[maxLinhas - 1];
    while (ctx.measureText(ultima + "…").width > larguraMax && ultima.length > 1) {
      ultima = ultima.slice(0, -1);
    }
    cortadas[maxLinhas - 1] = ultima + "…";
    return cortadas;
  }
  return linhas;
}

function exportarCarregarImageElement(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function exportarCarregarImagemComoDataUrl(url) {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Falha ao ler imagem"));
      leitor.readAsDataURL(blob);
    });
  } catch (erro) {
    console.error("[Carrinho Havaianas] Não consegui carregar imagem:", erro);
    return null;
  }
}

function exportarFormatarPrecoSemPrefixo(valor) {
  return Number(valor).toFixed(2).replace(".", ",");
}

// ---------- Monta a lista de "cartões" (1 por coleção+cor) a partir do
// carrinho — reaproveita o mesmo agrupamento já usado no painel do
// carrinho (agruparCarrinhoPorColecao / agruparItensPorCor, de app.js),
// pra ficar na mesma ordem que o cliente já vê lá. ----------
function exportarCardsDoCarrinho() {
  const porColecao = agruparCarrinhoPorColecao();
  const cards = [];
  porColecao.forEach(({ itens }, colecao) => {
    const porCor = agruparItensPorCor(itens);
    porCor.forEach((itensDaCor, cor) => {
      const produtoExemplo = itensDaCor[0].produto;
      cards.push({ colecao, cor, produto: produtoExemplo });
    });
  });
  return cards;
}

// ---------- Carrega template + fotos (produtos e vendedor) ----------
async function exportarCarregarRecursos(cards) {
  const dataUrlsPorImagem = new Map(); // imagem_url -> dataUrl
  await Promise.all(
    cards
      .filter((c) => c.produto.imagem_url)
      .map(async (c) => {
        if (dataUrlsPorImagem.has(c.produto.imagem_url)) return;
        const dataUrl = await exportarCarregarImagemComoDataUrl(c.produto.imagem_url);
        if (dataUrl) dataUrlsPorImagem.set(c.produto.imagem_url, dataUrl);
      })
  );
  const imagensPorUrl = new Map();
  await Promise.all(
    Array.from(dataUrlsPorImagem.entries()).map(async ([url, dataUrl]) => {
      const img = await exportarCarregarImageElement(dataUrl);
      if (img) imagensPorUrl.set(url, img);
    })
  );

  const fotoVendedorUrl = document.getElementById("vendedor-foto").src;
  const imagemVendedor = fotoVendedorUrl ? await exportarCarregarImageElement(fotoVendedorUrl) : null;
  const imagemTemplate = await exportarCarregarImageElement(EXPORT_TEMPLATE_CAMINHO);

  return { imagensPorUrl, imagemVendedor, imagemTemplate };
}

// ---------- Desenha a grade de cartões (usada só pelo PNG) ----------
function exportarDesenharGradeDeCartoes(ctx, cards, imagensPorUrl, opcoes) {
  const {
    colunas, areaEsq, areaTopo, larguraCard, alturaCard, gutterH, gutterV,
    padCard, larguraFoto, alturaImagem,
  } = opcoes;

  cards.forEach((card, indice) => {
    const coluna = indice % colunas;
    const linha = Math.floor(indice / colunas);
    const x = areaEsq + coluna * (larguraCard + gutterH);
    const y = areaTopo + linha * (alturaCard + gutterV);

    ctx.save();
    ctx.shadowColor = "rgba(20,18,14,0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#FFFFFF";
    exportarDesenharRetanguloArredondado(ctx, x, y, larguraCard, alturaCard, 14);
    ctx.fill();
    ctx.restore();

    const imagemCard = imagensPorUrl.get(card.produto.imagem_url);
    if (imagemCard) {
      ctx.save();
      exportarDesenharRetanguloArredondado(ctx, x + padCard, y + padCard, larguraFoto, alturaImagem, 8);
      ctx.clip();
      exportarDesenharImagemPreenchendo(ctx, imagemCard, x + padCard, y + padCard, larguraFoto, alturaImagem);
      ctx.restore();
    } else {
      ctx.fillStyle = "#F4F3EE";
      exportarDesenharRetanguloArredondado(ctx, x + padCard, y + padCard, larguraFoto, alturaImagem, 8);
      ctx.fill();
    }

    const emNegociacao = !!card.produto.negociacao;
    const alturaBadge = EXPORT_GRADE_ALTURA_BADGE;
    const larguraBadge = larguraFoto;
    const xBadge = x + padCard;
    const yBadge = y + alturaCard - padCard - alturaBadge;

    ctx.font = "600 17px 'Inter', sans-serif";
    const linhaColecao = exportarQuebrarTextoCanvas(ctx, card.colecao.toUpperCase(), larguraFoto, 1)[0];

    ctx.font = "italic 700 20px 'Playfair Display', serif";
    const linhasNome = exportarQuebrarTextoCanvas(ctx, card.cor, larguraFoto, EXPORT_GRADE_MAX_LINHAS_NOME);

    const gapColecaoBadge = EXPORT_GRADE_GAP_COLECAO_BADGE;
    const gapNomeColecao = EXPORT_GRADE_GAP_NOME_COLECAO;
    const linhaAlturaNome = EXPORT_GRADE_LINHA_ALTURA_NOME;

    const yColecao = yBadge - gapColecaoBadge;
    const yUltimaLinhaNome = yColecao - gapNomeColecao;
    const yPrimeiraLinhaNome = yUltimaLinhaNome - (linhasNome.length - 1) * linhaAlturaNome;

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "italic 700 20px 'Playfair Display', serif";
    linhasNome.forEach((linha, li) => ctx.fillText(linha, x + padCard, yPrimeiraLinhaNome + li * linhaAlturaNome));

    ctx.fillStyle = "#6b6b76";
    ctx.font = "600 17px 'Inter', sans-serif";
    ctx.fillText(linhaColecao, x + padCard, yColecao);

    ctx.save();
    ctx.shadowColor = "rgba(255,122,26,0.4)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = EXPORT_COR_BADGE;
    exportarDesenharRetanguloArredondado(ctx, xBadge, yBadge, larguraBadge, alturaBadge, 10);
    ctx.fill();
    ctx.restore();

    if (emNegociacao) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "italic 700 25px 'Playfair Display', serif";
      ctx.textAlign = "center";
      ctx.fillText("Negociação", x + larguraCard / 2, yBadge + alturaBadge / 2 + 7);
      ctx.textAlign = "left";
    } else {
      const precoTexto = exportarFormatarPrecoSemPrefixo(card.produto.preco);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 16px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("R$", xBadge + 11, yBadge + 16);
      ctx.textAlign = "right";
      ctx.fillStyle = "#cfe0f5";
      ctx.fillText("/par", xBadge + larguraBadge - 11, yBadge + 16);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "italic 700 36px 'Playfair Display', serif";
      ctx.textAlign = "center";
      ctx.fillText(precoTexto, x + larguraCard / 2, yBadge + alturaBadge - 14);
      ctx.textAlign = "left";
    }
  });
}

// ---------- Desenha a foto + nome do vendedor, à esquerda da logo ----------
function exportarDesenharCabecalhoVendedorCanvas(ctx, imagemVendedor) {
  const diam = EXPORT_VENDEDOR_FOTO_DIAMETRO;
  const x = EXPORT_VENDEDOR_FOTO_X;
  const yCentro = EXPORT_VENDEDOR_FOTO_Y_CENTRO;
  const y = yCentro - diam / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + diam / 2, yCentro, diam / 2, 0, Math.PI * 2);
  ctx.closePath();
  if (imagemVendedor) {
    ctx.clip();
    exportarDesenharImagemPreenchendo(ctx, imagemVendedor, x, y, diam, diam);
  } else {
    ctx.fillStyle = "#F4F3EE";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = EXPORT_COR_ANEL_VENDEDOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + diam / 2, yCentro, diam / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const nomeVendedor = (document.getElementById("vendedor-nome").textContent || "").trim();
  if (nomeVendedor) {
    const xNome = x + diam + 16;
    const larguraMaxNome = EXPORT_VENDEDOR_LOGO_INICIO_X - xNome - 10;
    ctx.fillStyle = EXPORT_COR_NOME_VENDEDOR;
    ctx.font = "italic 700 18px 'Playfair Display', serif";
    ctx.textAlign = "left";
    const linhaNome = exportarQuebrarTextoCanvas(ctx, nomeVendedor, larguraMaxNome, 1)[0];
    ctx.fillText(linhaNome, xNome, yCentro + 6);
  }
}

// Calcula o tamanho da grade da Imagem a partir do conteúdo dos cartões
// (não fileiras fixas) — devolve quantas fileiras cabem de verdade no
// espaço disponível, e portanto quantos cartões cabem por imagem.
function exportarCalcularGradePng() {
  const colunas = 4;
  const gutterH = 30;
  const gutterV = 22;
  const padCard = EXPORT_GRADE_PADCARD;
  const { esq: areaEsq, dir: areaDir, topo: areaTopo, base: areaBase } = EXPORT_TEMPLATE_AREA;
  const larguraUtil = areaDir - areaEsq;
  const alturaUtil = areaBase - areaTopo;
  const larguraCard = (larguraUtil - gutterH * (colunas - 1)) / colunas;
  const larguraFoto = larguraCard - padCard * 2;
  const alturaImagem = larguraFoto * EXPORT_GRADE_FATOR_ALTURA_FOTO;

  const alturaBlocoTexto =
    EXPORT_GRADE_GAP_FOTO_NOME +
    EXPORT_GRADE_MAX_LINHAS_NOME * EXPORT_GRADE_LINHA_ALTURA_NOME +
    EXPORT_GRADE_GAP_NOME_COLECAO +
    EXPORT_GRADE_GAP_COLECAO_BADGE;
  const alturaCard = padCard + alturaImagem + alturaBlocoTexto + EXPORT_GRADE_ALTURA_BADGE + padCard;

  const linhasGrade = Math.max(1, Math.floor((alturaUtil + gutterV) / (alturaCard + gutterV)));

  return {
    colunas, gutterH, gutterV, padCard, areaEsq, areaTopo, alturaUtil,
    larguraCard, alturaCard, larguraFoto, alturaImagem,
    linhasGrade, limite: colunas * linhasGrade,
  };
}

// A Imagem (PNG) é uma folha de tamanho fixo (ao contrário do PDF, que só
// usa quantas páginas precisar), então quando o carrinho tem menos cartões
// do que cabe na grade, sobra espaço em branco no final. Em vez de deixar
// essa sobra toda embaixo, o espaço entre as fileiras fica sempre igual, e
// só o bloco inteiro é centralizado verticalmente.
function exportarAjustarEspacamentoPng(grade, totalCards) {
  const { colunas, gutterV, alturaCard, areaTopo, alturaUtil } = grade;
  const linhasReais = Math.max(1, Math.ceil(totalCards / colunas));

  const alturaBlocoGrade = linhasReais * alturaCard + (linhasReais - 1) * gutterV;
  const areaTopoAjustada = areaTopo + Math.max(0, (alturaUtil - alturaBlocoGrade) / 2);

  return { gutterV, areaTopo: areaTopoAjustada };
}

// ---------- Botão "Gerar Imagem" ----------
async function exportarGerarImagemCarrinho() {
  const todosCards = exportarCardsDoCarrinho();

  if (todosCards.length === 0) {
    alert("Seu carrinho está vazio. Adicione itens antes de gerar a imagem.");
    return;
  }

  const {
    colunas, gutterH, gutterV, padCard, areaEsq, areaTopo, alturaUtil,
    larguraCard, alturaCard, larguraFoto, alturaImagem, limite,
  } = exportarCalcularGradePng();

  let cardsParaImagem = todosCards;
  if (todosCards.length > limite) {
    cardsParaImagem = todosCards.slice(0, limite);
    alert(
      `Seu carrinho tem mais de ${limite} produtos diferentes — a imagem mostra só os ${limite} primeiros.\n\n` +
      `Pra ver a lista completa, gera o PDF.`
    );
  }

  const botao = document.getElementById("btn-exportar-imagem-ofertas");
  botao.disabled = true;
  try {
    const { imagensPorUrl, imagemVendedor, imagemTemplate } = await exportarCarregarRecursos(cardsParaImagem);

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (erroFontes) { /* segue com a fonte padrão */ }
    }

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_TEMPLATE_LARGURA * EXPORT_PNG_ESCALA;
    canvas.height = EXPORT_TEMPLATE_ALTURA * EXPORT_PNG_ESCALA;
    const ctx = canvas.getContext("2d");
    ctx.scale(EXPORT_PNG_ESCALA, EXPORT_PNG_ESCALA);

    if (imagemTemplate) {
      ctx.drawImage(imagemTemplate, 0, 0, EXPORT_TEMPLATE_LARGURA, EXPORT_TEMPLATE_ALTURA);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, EXPORT_TEMPLATE_LARGURA, EXPORT_TEMPLATE_ALTURA);
    }

    exportarDesenharCabecalhoVendedorCanvas(ctx, imagemVendedor);

    const { gutterV: gutterVAjustado, areaTopo: areaTopoAjustada } = exportarAjustarEspacamentoPng(
      { colunas, gutterV, alturaCard, areaTopo, alturaUtil },
      cardsParaImagem.length
    );

    exportarDesenharGradeDeCartoes(ctx, cardsParaImagem, imagensPorUrl, {
      colunas, areaEsq, areaTopo: areaTopoAjustada, larguraCard, alturaCard,
      gutterH, gutterV: gutterVAjustado, padCard, larguraFoto, alturaImagem,
    });

    const dataArquivo = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.download = `carrinho-havaianas-${dataArquivo}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (erro) {
    console.error("[Carrinho Havaianas] Erro ao gerar imagem:", erro);
    alert("Não consegui gerar a imagem. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
}

// ---------- Botão "Gerar PDF" ----------
async function exportarGerarPdfCarrinho() {
  const todosCards = exportarCardsDoCarrinho();

  if (todosCards.length === 0) {
    alert("Seu carrinho está vazio. Adicione itens antes de gerar o PDF.");
    return;
  }

  const botao = document.getElementById("btn-exportar-pdf-ofertas");
  botao.disabled = true;

  try {
    const { imagensPorUrl, imagemVendedor, imagemTemplate } = await exportarCarregarRecursos(todosCards);

    let templateDataUrl = null;
    if (imagemTemplate) {
      const canvasTemplate = document.createElement("canvas");
      canvasTemplate.width = imagemTemplate.width;
      canvasTemplate.height = imagemTemplate.height;
      canvasTemplate.getContext("2d").drawImage(imagemTemplate, 0, 0);
      templateDataUrl = canvasTemplate.toDataURL("image/jpeg", 0.92);
    }

    // Foto do vendedor + o anel dourado, prontas como uma imagem circular
    // só (recortada aqui, porque o jsPDF não recorta imagem sozinho).
    let fotoVendedorDataUrl = null;
    if (imagemVendedor) {
      const diamPx = 240;
      const canvasFoto = document.createElement("canvas");
      canvasFoto.width = diamPx;
      canvasFoto.height = diamPx;
      const ctxFoto = canvasFoto.getContext("2d");
      ctxFoto.save();
      ctxFoto.beginPath();
      ctxFoto.arc(diamPx / 2, diamPx / 2, diamPx / 2, 0, Math.PI * 2);
      ctxFoto.closePath();
      ctxFoto.clip();
      exportarDesenharImagemPreenchendo(ctxFoto, imagemVendedor, 0, 0, diamPx, diamPx);
      ctxFoto.restore();
      fotoVendedorDataUrl = canvasFoto.toDataURL("image/png");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const larguraPagina = 210;
    const alturaPagina = 297;

    const escalaX = larguraPagina / EXPORT_TEMPLATE_LARGURA;
    const escalaY = alturaPagina / EXPORT_TEMPLATE_ALTURA;
    const areaEsq = EXPORT_TEMPLATE_AREA.esq * escalaX;
    const areaDir = EXPORT_TEMPLATE_AREA.dir * escalaX;
    const areaTopo = EXPORT_TEMPLATE_AREA.topo * escalaY;
    const areaBase = EXPORT_TEMPLATE_AREA.base * escalaY;
    const margemX = areaEsq;
    const larguraUtil = areaDir - areaEsq;

    function desenharFundo() {
      if (templateDataUrl) {
        doc.addImage(templateDataUrl, "JPEG", 0, 0, larguraPagina, alturaPagina);
      }
    }

    function desenharCabecalhoVendedor() {
      const diamMm = EXPORT_VENDEDOR_FOTO_DIAMETRO * escalaX;
      const xFoto = EXPORT_VENDEDOR_FOTO_X * escalaX;
      const yCentroMm = EXPORT_VENDEDOR_FOTO_Y_CENTRO * escalaY;
      const yFoto = yCentroMm - diamMm / 2;
      if (fotoVendedorDataUrl) {
        doc.addImage(fotoVendedorDataUrl, "PNG", xFoto, yFoto, diamMm, diamMm);
      }
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.circle(xFoto + diamMm / 2, yCentroMm, diamMm / 2, "S");

      const nomeVendedor = (document.getElementById("vendedor-nome").textContent || "").trim();
      if (nomeVendedor) {
        const xNome = xFoto + diamMm + 4;
        const larguraMaxNome = EXPORT_VENDEDOR_LOGO_INICIO_X * escalaX - xNome - 3;
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(8.5);
        doc.setTextColor(10, 69, 149);
        const linhasNome = doc.splitTextToSize(nomeVendedor, larguraMaxNome);
        const nomeExibido = linhasNome.length > 1 ? `${linhasNome[0]}…` : linhasNome[0];
        doc.text(nomeExibido, xNome, yCentroMm + 1.2);
      }
    }

    desenharFundo();
    desenharCabecalhoVendedor();

    let y = areaTopo;

    const colunas = 4;
    const gutterH = 4;
    const gutterV = 7;
    const larguraCard = (larguraUtil - gutterH * (colunas - 1)) / colunas;
    const padCard = 2.2;
    const larguraFoto = larguraCard - padCard * 2;
    // Foto um pouco mais baixa que larga (em vez de quadrada) — mesma
    // regra da Imagem.
    const alturaFoto = larguraFoto * EXPORT_PDF_FATOR_ALTURA_FOTO;
    const alturaBadge = 9.6;
    const alturaTextos = 12.5;
    const alturaCard = padCard + alturaFoto + alturaTextos + alturaBadge + padCard;

    // Recorte já no formato final da foto (largura x altura, não mais um
    // quadrado) — se não fizer isso aqui, a imagem quadrada recortada
    // abaixo ficaria esticada ao ser encaixada numa caixa não-quadrada.
    const larguraFotoPx = Math.round(larguraFoto * (300 / 25.4));
    const alturaFotoPx = Math.round(alturaFoto * (300 / 25.4));
    const fotosRecortadas = new Map();
    imagensPorUrl.forEach((img, url) => {
      const canvasFoto = document.createElement("canvas");
      canvasFoto.width = larguraFotoPx;
      canvasFoto.height = alturaFotoPx;
      exportarDesenharImagemPreenchendo(canvasFoto.getContext("2d"), img, 0, 0, larguraFotoPx, alturaFotoPx);
      fotosRecortadas.set(url, canvasFoto.toDataURL("image/jpeg", 0.9));
    });

    // Grade contínua, sem separar por coleção — igual já é feito na
    // Imagem (o pedido dentro de cada coleção continua agrupado, só não
    // aparece mais o nome da coleção como título entre os grupos).
    let coluna = 0;
    todosCards.forEach((card) => {
      if (coluna === 0 && y + alturaCard > areaBase) {
        doc.addPage();
        desenharFundo();
        desenharCabecalhoVendedor();
        y = areaTopo;
      }

      const x = margemX + coluna * (larguraCard + gutterH);

      doc.setDrawColor(225, 224, 218);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, larguraCard, alturaCard, 1.8, 1.8, "FD");

      const fotoDataUrl = fotosRecortadas.get(card.produto.imagem_url);
      if (fotoDataUrl) {
        try {
          doc.addImage(fotoDataUrl, "JPEG", x + padCard, y + padCard, larguraFoto, alturaFoto);
        } catch (erro) {
          console.error("[Carrinho Havaianas] Erro ao inserir imagem no PDF:", erro);
        }
      } else {
        doc.setFillColor(244, 243, 238);
        doc.rect(x + padCard, y + padCard, larguraFoto, alturaFoto, "F");
      }

      const emNegociacao = !!card.produto.negociacao;
      const larguraBadge = larguraFoto;
      const xBadge = x + padCard;
      const yBadge = y + alturaCard - padCard - alturaBadge;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      const linhaColecao = doc.splitTextToSize(card.colecao.toUpperCase(), larguraFoto)[0];

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8.3);
      const todasLinhasNome = doc.splitTextToSize(card.cor, larguraFoto);
      const linhasNome = todasLinhasNome.slice(0, 2);
      if (todasLinhasNome.length > 2 && linhasNome[1].length > 1) {
        linhasNome[1] = linhasNome[1].slice(0, -1) + "…";
      }

      const gapColecaoBadge = 2.6;
      const gapNomeColecao = 3.4;
      const linhaAlturaNome = 3.4;

      const yColecao = yBadge - gapColecaoBadge;
      const yUltimaLinhaNome = yColecao - gapNomeColecao;
      const yPrimeiraLinhaNome = yUltimaLinhaNome - (linhasNome.length - 1) * linhaAlturaNome;

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8.3);
      linhasNome.forEach((linha, li) => doc.text(linha, x + padCard, yPrimeiraLinhaNome + li * linhaAlturaNome));

      doc.setTextColor(107, 107, 118);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.text(linhaColecao, x + padCard, yColecao);

      doc.setFillColor(10, 69, 149);
      doc.roundedRect(xBadge, yBadge, larguraBadge, alturaBadge, 1.6, 1.6, "F");

      if (emNegociacao) {
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(10.5);
        doc.setTextColor(255, 255, 255);
        doc.text("Negociação", x + larguraCard / 2, yBadge + alturaBadge / 2 + 1.8, { align: "center" });
      } else {
        const precoTexto = exportarFormatarPrecoSemPrefixo(card.produto.preco);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.6);
        doc.setTextColor(255, 255, 255);
        doc.text("R$", xBadge + 2, yBadge + 3.4);
        doc.setTextColor(207, 224, 245);
        doc.text("/par", xBadge + larguraBadge - 2, yBadge + 3.4, { align: "right" });

        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(15);
        doc.setTextColor(255, 255, 255);
        doc.text(precoTexto, x + larguraCard / 2, yBadge + alturaBadge - 3, { align: "center" });
      }

      coluna++;
      if (coluna === colunas) {
        coluna = 0;
        y += alturaCard + gutterV;
      }
    });

    const dataArquivo = new Date().toISOString().slice(0, 10);
    doc.save(`carrinho-havaianas-${dataArquivo}.pdf`);
  } catch (erro) {
    console.error("[Carrinho Havaianas] Erro ao gerar PDF:", erro);
    alert("Não consegui gerar o PDF. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
}

// ---------- Botão "PDF do pedido" — tela do carrinho (perto da lixeira) ----------
// Cópia simples (só texto, sem molde/fotos) do mesmo pedido que vai pro
// WhatsApp — mesma estrutura de montarTextoPedido (app.js): agrupado por
// coleção e, dentro dela, por cor, com uma linha por numeração — pra quem
// não consegue usar o WhatsApp Web no computador ainda conseguir
// baixar/mandar um PDF com os itens.
function exportarPdfPedidoTexto() {
  const porColecao = agruparCarrinhoPorColecao();

  if (porColecao.size === 0) {
    alert("Seu carrinho está vazio. Adicione itens antes de gerar o PDF do pedido.");
    return;
  }

  const botao = document.getElementById("btn-pdf-pedido");
  botao.disabled = true;

  try {
    const nomeLoja = document.getElementById("input-loja").value.trim();
    const nomeVendedor = (document.getElementById("vendedor-nome").textContent || "").trim();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margemX = 18;
    const larguraPagina = 210;
    const larguraUtil = larguraPagina - margemX * 2;
    const areaBase = 280;
    let y = 20;

    function novaPaginaSeNecessario(alturaNecessaria) {
      if (y + alturaNecessaria > areaBase) {
        doc.addPage();
        y = 20;
      }
    }

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(18);
    doc.setTextColor(10, 69, 149);
    doc.text(`Pedido — ${CONFIG.nomeCatalogo}`, margemX, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    const dataTexto = new Date().toLocaleDateString("pt-BR");
    doc.text(`Vendedor: ${nomeVendedor || "-"}   •   Data: ${dataTexto}`, margemX, y);
    y += 6;
    doc.text(`Loja: ${nomeLoja || "Não informada"}`, margemX, y);
    y += 11;

    porColecao.forEach(({ exemplo, itens }, colecao) => {
      novaPaginaSeNecessario(14);

      const rotuloColecao = exemplo.negociacao ? "Negociação" : formatarPreco(exemplo.preco);
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(12);
      doc.setTextColor(10, 69, 149);
      doc.text(`${colecao.toUpperCase()} — ${rotuloColecao}`, margemX, y);
      y += 2.5;

      doc.setDrawColor(220, 226, 232);
      doc.setLineWidth(0.3);
      doc.line(margemX, y, margemX + larguraUtil, y);
      y += 6.5;

      const porCor = agruparItensPorCor(itens);
      porCor.forEach((itensDaCor, cor) => {
        novaPaginaSeNecessario(8);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(40, 40, 40);
        doc.text(cor.toUpperCase(), margemX, y);
        y += 5.3;

        itensDaCor.forEach(({ produto, quantidade }) => {
          novaPaginaSeNecessario(6);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(90, 90, 90);
          doc.text(`Cód: ${produto.codigo}  •  ${produto.numeracao}  •  Qtd: ${quantidade}`, margemX + 3, y);
          y += 5.3;
        });

        y += 1.5;
      });

      y += 2.5;
    });

    novaPaginaSeNecessario(16);
    doc.setDrawColor(10, 69, 149);
    doc.setLineWidth(0.5);
    doc.line(margemX, y, margemX + larguraUtil, y);
    y += 8;

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(13.5);
    doc.setTextColor(10, 69, 149);
    doc.text("TOTAL DO PEDIDO", margemX, y);
    doc.text(exportarFormatarPrecoSemPrefixo(calcularTotalCarrinho()).replace(/^/, "R$ "), margemX + larguraUtil, y, { align: "right" });

    if (temItemEmNegociacao()) {
      y += 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(130, 130, 130);
      doc.text("(itens em negociação não entram nesse total)", margemX, y);
    }

    const dataArquivo = new Date().toISOString().slice(0, 10);
    doc.save(`pedido-havaianas-${dataArquivo}.pdf`);
  } catch (erro) {
    console.error("[Carrinho Havaianas] Erro ao gerar PDF do pedido:", erro);
    alert("Não consegui gerar o PDF do pedido. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-exportar-imagem-ofertas").addEventListener("click", exportarGerarImagemCarrinho);
  document.getElementById("btn-exportar-pdf-ofertas").addEventListener("click", exportarGerarPdfCarrinho);
  document.getElementById("btn-pdf-pedido").addEventListener("click", exportarPdfPedidoTexto);
});
