// config/crossSellUpsell.js
module.exports = {
  // ── Cross‑sell categories ───────────────────────────────────
  crossSellCategories: {
    "Sanduíches": ["Coca Cola Lata", "Guarana Lata", "Fanta Lata 350ml"],
    "Macarrão":   ["Coca Cola Lata", "Guarana Lata"],
    "Bebidas":    ["Paçoca", "Pirulito"]
  },

  // ── Product upgrade paths ──────────────────────────────────
  upsellMap: {
    "Hamburguer":             { upgrade: "X-burguer",            message: "Que tal um X‑Burguer com queijo? 🧀" },
    "X-burguer":              { upgrade: "X-Bacon",              message: "Adicione bacon crocante! 🥓" },
    "X-Salada":               { upgrade: "X-Tudo",               message: "Leve o X‑Tudo e tenha tudo de uma vez! 🍔" },
    "X-Egg":                  { upgrade: "X-Egg Bacon",          message: "Que tal adicionar bacon ao seu X‑Egg? 🍳🥓" },
    "Hambúrguer Especial":    { upgrade: "X-Tudo",               message: "Experimente o X‑Tudo, o mais completo! 🍔" },
    "X-Bacon":                { upgrade: "X-Egg Bacon",          message: "Adicione um ovo e vire X‑Egg Bacon! 🍳" },
    "X-Galinha":              { upgrade: "Laçador",              message: "Suba para o Laçador e ganhe mais sabor! 🐂" },
    "Laçador":                { upgrade: "X-Picanha",            message: "Que tal um X‑Picanha? Carne nobre! 🥩" },
    "Misto":                  { upgrade: "X-burguer",            message: "Transforme seu misto em X‑Burguer! 🍔" },
    "Cachorro Quente":        { upgrade: "X-Salada",             message: "Troque o cachorro por um X‑Salada! 🥗" },
    "Macarrão Chapa P":       { upgrade: "Macarrão Chapa G",     message: "Tamanho G por apenas R$9 a mais! 🍝" },
    "Macarrão Bolonhesa P":   { upgrade: "Macarrão Bolonhesa G", message: "Tamanho G de bolonhesa! 🍝" },
    "Coca Cola Lata":         { upgrade: "Coca 1L",              message: "Mais Coca por apenas R$4 a mais! 🥤" },
    "Guarana Lata":           { upgrade: "Guarana Lata",         message: "Que tal mais um Guaraná? 😋" },
    "Fanta Lata 350ml":       { upgrade: "Fanta 2L",             message: "Fanta 2L para compartilhar! 🍊" },
    "Coca Lata Zero":         { upgrade: "Coca Zero 1 Litro",    message: "Coca Zero 1L, bem gelada! 🧊" },
    "Suco Del Vale":          { upgrade: "Suco Del Vale",        message: "Outro suco para matar a sede! 🍹" },
    "Água 500ml":             { upgrade: "Água com gás 500ml",   message: "Experimente a água com gás! 💧" },
    "Mate Couro 1L":          { upgrade: "Mate Couro 1L",        message: "Recarregue o mate! 🧉" },
  },

  // ── Popular additions to upsell ────────────────────────────
  popularAdditions: [
    { name: "Bacon",    price: 4, msg: "🥓 Que tal adicionar Bacon crocante por apenas R$4? Use BACON10 e ganhe 10% off no adicional!" },
    { name: "Cheddar",  price: 4, msg: "🧀 Cheddar derretido por R$4? Fica irresistível! Cupom CHED10." },
    { name: "Catupiry", price: 4, msg: "🍦 Catupiry cremoso no seu lanche por R$4. Use CATU10." },
    { name: "Carne 120g Picanha", price: 5, msg: "🥩 Troque por carne de picanha (120g) por R$5. Cupom PICA10." },
    { name: "Ovo",      price: 2, msg: "🍳 Um ovo a mais no lanche por R$2. Use OVO10." },
  ]
};