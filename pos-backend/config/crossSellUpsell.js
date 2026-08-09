module.exports = {
  crossSellCategories: {
    "Sanduíches": ["Coca Cola Lata", "Guarana Lata", "Fanta Lata 350ml"],
    "Macarrão":   ["Coca Cola Lata", "Guarana Lata"],
    "Bebidas":    ["Paçoca", "Pirulito"]
  },

  upsellMap: {
    "Hamburguer":             { upgrade: "X-burguer",            priceDiff: 3.5 },
    "X-burguer":              { upgrade: "X-Bacon",              priceDiff: 4 },
    "X-Salada":               { upgrade: "X-Tudo",               priceDiff: 14.5 },
    "X-Egg":                  { upgrade: "X-Egg Bacon",          priceDiff: 3 },
    "Hambúrguer Especial":    { upgrade: "X-Tudo",               priceDiff: 13.5 },
    "X-Bacon":                { upgrade: "X-Egg Bacon",          priceDiff: 1 },
    "X-Galinha":              { upgrade: "Laçador",              priceDiff: 0.5 },
    "Laçador":                { upgrade: "X-Picanha",            priceDiff: 11 },
    "Misto":                  { upgrade: "X-burguer",            priceDiff: 3.5 },
    "Cachorro Quente":        { upgrade: "X-Salada",             priceDiff: 3 },
    "Macarrão Chapa P":       { upgrade: "Macarrão Chapa G",     priceDiff: 9 },
    "Macarrão Bolonhesa P":   { upgrade: "Macarrão Bolonhesa G", priceDiff: 9 },
    "Coca Cola Lata":         { upgrade: "Coca 1L",              priceDiff: 4 },
    "Guarana Lata":           { upgrade: "Guarana Lata",         priceDiff: 0 },
    "Fanta Lata 350ml":       { upgrade: "Fanta 2L",             priceDiff: 6 },
    "Coca Lata Zero":         { upgrade: "Coca Zero 1 Litro",    priceDiff: 4 },
    "Suco Del Vale":          { upgrade: "Suco Del Vale",        priceDiff: 0 },
    "Água 500ml":             { upgrade: "Água com gás 500ml",   priceDiff: 0.5 },
    "Mate Couro 1L":          { upgrade: "Mate Couro 1L",        priceDiff: 0 },
  },

  popularAdditions: [
    { name: "Bacon",    price: 4, msg: "🥓 Adicione Bacon crocante por apenas R$4! Use BACON10 e ganhe 10% off." },
    { name: "Cheddar",  price: 4, msg: "🧀 Cheddar derretido por só R$4. Cupom CHED10." },
    { name: "Catupiry", price: 4, msg: "🍦 Catupiry cremoso por R$4. Use CATU10." },
    { name: "Carne 120g Picanha", price: 5, msg: "🥩 Carne de picanha (120g) por apenas R$5 a mais. Cupom PICA10." },
    { name: "Ovo",      price: 2, msg: "🍳 Um ovo extra por R$2. Use OVO10." },
  ]
};