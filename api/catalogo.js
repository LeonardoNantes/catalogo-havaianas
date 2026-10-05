// ============================================================
// /api/catalogo — serve a MESMA página do catálogo (catalogo-base.html), só
// trocando o título de pré-visualização (og:title) pelo nome do vendedor
// dono desse link, antes de entregar pro navegador/WhatsApp.
// ============================================================
// Por quê isso existe: o WhatsApp (e similares) não executa o JavaScript
// da página pra montar o card de pré-visualização do link — ele só lê o
// HTML bruto que o servidor manda na hora. Então pra aparecer o nome do
// vendedor certo em "Havaianas 2026 - Fulano" a gente precisa descobrir
// quem é o vendedor e já devolver o texto pronto, antes da página chegar
// no WhatsApp. O catálogo em si (produtos, carrinho, etc) continua
// carregando do jeito de sempre, pelo app.js no navegador.
//
// Como funciona: o vercel.json manda a rota "/" pra cá (as outras rotas -
// style.css, app.js, imagens etc - continuam sendo servidas direto, sem
// passar por aqui). Essa função busca o conteúdo real da página pelo
// endereço "/catalogo-base.html".
//
// IMPORTANTE: não pode existir NENHUM arquivo chamado "index.html" na raiz
// do repositório. O Vercel serve "index.html" como arquivo estático direto
// pra "/" automaticamente, por cima de QUALQUER regra do vercel.json - ou
// seja, só o fato desse arquivo existir já faz o Vercel ignorar essa
// função inteira pra "/", mesmo com o rewrite configurado certinho (foi
// exatamente isso que aconteceu na primeira tentativa). Por isso o
// conteúdo real do catálogo mora em "/catalogo-base.html" (outro nome,
// sem esse efeito especial), e não em "/index.html".
//
// Depois descobre o vendedor do mesmo jeito que o app já faz
// (resolverVendedorId, em supabase-client.js: primeiro o parâmetro ?v=,
// senão o domínio antigo na tabela dominios_antigos) e troca o texto antes
// de responder.
//
// Se der qualquer erro (Supabase fora do ar, etc), cai pro
// catalogo-base.html original sem travar o catálogo pro cliente.

const SUPABASE_URL = "https://eubbzefshftafjjcirna.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GZ-duizLJSQSVcdYejzWGQ_wdNUu8vA";

async function buscarSlug(req) {
  const vParam = req.query ? req.query.v : null;
  if (vParam) {
    const valor = Array.isArray(vParam) ? vParam[0] : vParam;
    return String(valor).trim();
  }

  const dominio = req.headers.host;
  if (!dominio) return null;

  try {
    const resposta = await fetch(
      `${SUPABASE_URL}/rest/v1/dominios_antigos?dominio=eq.${encodeURIComponent(dominio)}&select=slug&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resposta.ok) return null;
    const linhas = await resposta.json();
    return (linhas[0] && linhas[0].slug) || null;
  } catch (erro) {
    console.error("[Havaianas] /api/catalogo: erro ao resolver vendedor pelo domínio:", erro);
    return null;
  }
}

async function buscarNomeVendedor(slug) {
  if (!slug) return "";
  try {
    const resposta = await fetch(
      `${SUPABASE_URL}/rest/v1/vendedores?slug=eq.${encodeURIComponent(slug)}&select=nome&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resposta.ok) return "";
    const linhas = await resposta.json();
    return (linhas[0] && linhas[0].nome) || "";
  } catch (erro) {
    console.error("[Havaianas] /api/catalogo: erro ao buscar nome do vendedor:", erro);
    return "";
  }
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async (req, res) => {
  try {
    const protocolo = req.headers["x-forwarded-proto"] || "https";
    const origem = `${protocolo}://${req.headers.host}`;

    const [respostaHtml, slug] = await Promise.all([
      fetch(`${origem}/catalogo-base.html`),
      buscarSlug(req),
    ]);

    if (!respostaHtml.ok) {
      res.status(respostaHtml.status).send(await respostaHtml.text());
      return;
    }

    let html = await respostaHtml.text();
    const nome = await buscarNomeVendedor(slug);

    const titulo = nome ? `Havaianas 2026 - ${nome}` : "Havaianas 2026";

    html = html.split("__OG_TITLE__").join(escaparHtml(titulo));

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (erro) {
    console.error("[Havaianas] /api/catalogo: erro geral, caindo pro catalogo-base.html original:", erro);
    res.redirect(307, "/catalogo-base.html");
  }
};
