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

  // Cada segmento tem sua própria paleta de tons (suaves, sem nada
  // gritante) — usada tanto no card do segmento (tela inicial) quanto nos
  // cards de coleção dentro dele. Isso ajuda o cliente a se localizar
  // ("tô no verde, então é Unissex"). O cabeçalho, carrinho e preço
  // continuam sempre com corPrimaria/corDestaque, sem variar por segmento.
  paletasPorSegmento: {
    Masculino: ["#0A4595", "#1657A8", "#2E6FBE", "#123B73", "#3D7DC4", "#0D2F5C", "#4C8FD4", "#164A8C"],
    Feminino: ["#A85570", "#B96784", "#8F4460", "#C1738D", "#7A3850", "#AE5D78", "#9C4E68", "#C87D97"],
    Rasteiras: ["#BE7550", "#CC8763", "#A5613F", "#D89A7A", "#8F4E2F", "#C47D58", "#B06D48", "#D08E6A"],
    Unissex: ["#5C8368", "#6B9377", "#4A6E55", "#7DA487", "#3E5C47", "#638A6F", "#527862", "#729D7C"],
    "Kids / Baby": ["#B8873A", "#C69850", "#9E7127", "#D0A868", "#8A5D1E", "#BE8F45", "#A87C33", "#CDA05C"],
    "Licenças Adultas": ["#7A5A82", "#8A6B92", "#654A6D", "#9A7EA1", "#503A56", "#815F89", "#6E4F76", "#8F6C97"],
  },

  // ---- Supabase ----
  // Mesmo projeto Supabase usado no Impala/Nadir — só muda a tabela e o bucket.
  supabase: {
    url: "https://eubbzefshftafjjcirna.supabase.co",
    anonKey: "sb_publishable_GZ-duizLJSQSVcdYejzWGQ_wdNUu8vA",
    tabela: "havaianas", // nome da tabela de produtos da Havaianas no Supabase
    bucketImagens: "produtos-havaianas", // bucket público com as fotos, nomeadas pelo código representante de cada card
  },
};
