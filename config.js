// ============================================================
// CONFIGURAÇÃO DO CATÁLOGO — edite este arquivo para personalizar
// ============================================================
// Este é o ÚNICO arquivo que muda de um vendedor para outro.
// Para criar o catálogo de outro vendedor, copie a pasta inteira
// e troque só os valores aqui embaixo.
// (a exceção é o arquivo plataforma.js, que NÃO muda entre vendedores)

const CONFIG = {
  // ---- Identificador único deste catálogo (marca + vendedor) ----
  // Usado pra checar na tabela "vendedores" se este catálogo está ativo
  // (assinatura em dia) ou pausado. Cada vendedor de cada marca tem o seu.
  vendedorId: "havaianas-leonardo",

  // ---- Marca / catálogo ----
  marca: "Havaianas",
  nomeCatalogo: "Loja Havaianas",
  sloganMarca: "👣 Todo dia é dia de Havaianas 👣",

  // ---- Dados do vendedor (aparecem no cabeçalho e no link do WhatsApp) ----
  vendedor: {
    nome: "Leonardo Nantes",
    slogan: "O seu Vendedor!",
    foto: "assets/vendedor-foto.jpg",
    // Número de WhatsApp no formato internacional, só números (DDI 55 + DDD + número)
    whatsapp: "5547997375295",
  },

  // ---- Cores da marca (usadas no cabeçalho e nos botões) ----
  // Paleta proposta pra Havaianas: azul profundo (linha clássica da marca) com
  // um acento laranja/amarelo (o "sol" do logo). Fica a critério do Leonardo
  // ajustar se quiser outro tom.
  corPrimaria: "#0A4595", // fundo do cabeçalho — azul Havaianas
  corDestaque: "#FF7A1A", // carrinho flutuante, preços em destaque — laranja sol

  // Paleta dos cards de segmento e coleção — tons de azul, variando a
  // intensidade pra dar diferença visual sem fugir do tema da marca.
  paletaCards: ["#0A4595", "#1657A8", "#2E6FBE", "#123B73", "#3D7DC4", "#0D2F5C", "#4C8FD4", "#164A8C"],

  // ---- Supabase ----
  // Mesmo projeto Supabase usado no Impala/Nadir — só muda a tabela e o bucket.
  supabase: {
    url: "https://eubbzefshftafjjcirna.supabase.co",
    anonKey: "sb_publishable_GZ-duizLJSQSVcdYejzWGQ_wdNUu8vA",
    tabela: "havaianas", // nome da tabela de produtos da Havaianas no Supabase
    bucketImagens: "produtos-havaianas", // bucket público com as fotos, nomeadas pelo código representante de cada card
  },
};
