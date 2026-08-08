// config/crossSellUpsell.js
module.exports = {
  // For cross-sell: category → suggested product(s)
  crossSellCategories: {
    burger: ["Coca-Cola Lata", "Guaraná Lata"],
    drink: ["Batata Frita", "Onion Rings"],
  },
  // For upsell: original product name → upgraded product name (and message)
  upsellMap: {
    "X-Bacon": { upgrade: "X-Bacon Duplo", message: "Que tal um X-Bacon Duplo hoje? 🍔" },
    "X-Tudo":  { upgrade: "X-Tudo Especial", message: "Leve o X-Tudo Especial e ganhe mais sabor! 🍔" },
    // Add more as needed
  },
};