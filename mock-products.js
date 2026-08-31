// ============================================================
// PRODUTOS DE EXEMPLO (MOCK)
// ============================================================
// Só usados se o Supabase não estiver configurado ainda, ou se a conexão
// falhar — assim o catálogo nunca fica em branco. Mesma estrutura da tabela
// real: codigo, segmento, colecao, cor, numeracao, ordem, fracao, preco,
// negociacao. O preço vive na coleção (repetido em cada linha), não no
// código — e negociacao=true faz o app não mostrar/somar preço nessa coleção.

const MOCK_PRODUCTS = [
  // Masculino > Step Out > Areia — coleção com preço normal, fração unitária
  { codigo: 1225433, segmento: "Masculino", colecao: "Step Out", cor: "Areia", numeracao: "37/38", ordem: 0, fracao: 1, preco: 9.97, negociacao: false },
  { codigo: 1225434, segmento: "Masculino", colecao: "Step Out", cor: "Areia", numeracao: "39/40", ordem: 1, fracao: 1, preco: 9.97, negociacao: false },
  { codigo: 1225435, segmento: "Masculino", colecao: "Step Out", cor: "Areia", numeracao: "41/42", ordem: 2, fracao: 1, preco: 9.97, negociacao: false },
  { codigo: 1225436, segmento: "Masculino", colecao: "Step Out", cor: "Areia", numeracao: "43/44", ordem: 3, fracao: 1, preco: 9.97, negociacao: false },
  { codigo: 1225437, segmento: "Masculino", colecao: "Step Out", cor: "Areia", numeracao: "45/46", ordem: 4, fracao: 1, preco: 9.97, negociacao: false },

  // Unissex > Top Adulto > Amarelo Pop — fração múltiplo de 2, ainda com preço
  { codigo: 1221317, segmento: "Unissex", colecao: "Top Adulto", cor: "Amarelo Pop", numeracao: "33/34", ordem: 5, fracao: 2, preco: 9.97, negociacao: false },
  { codigo: 1221318, segmento: "Unissex", colecao: "Top Adulto", cor: "Amarelo Pop", numeracao: "35/36", ordem: 6, fracao: 2, preco: 9.97, negociacao: false },

  // Unissex > Tradicional > Azul — fração múltiplo de 6, e coleção Unissex = negociação
  { codigo: 1205650, segmento: "Unissex", colecao: "Tradicional", cor: "Azul", numeracao: "33/34", ordem: 7, fracao: 6, preco: null, negociacao: true },
  { codigo: 1205660, segmento: "Unissex", colecao: "Tradicional", cor: "Azul", numeracao: "35/36", ordem: 8, fracao: 6, preco: null, negociacao: true },

  // Kids / Baby > Kids Top Lisa > Azul Naval — fração múltiplo de 2
  { codigo: 1224917, segmento: "Kids / Baby", colecao: "Kids Top Lisa", cor: "Azul Naval", numeracao: "23/24", ordem: 9, fracao: 2, preco: 9.97, negociacao: false },
  { codigo: 1224918, segmento: "Kids / Baby", colecao: "Kids Top Lisa", cor: "Azul Naval", numeracao: "25/26", ordem: 10, fracao: 2, preco: 9.97, negociacao: false },
];
