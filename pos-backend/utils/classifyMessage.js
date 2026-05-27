function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function classifyMessage(message, step) {
  const msg = normalize(message);

  switch (step) {
    case "PERGUNTAR_TIPO":
      if (msg.includes("entrega") || msg.includes("delivery") || msg.includes("entregar"))
        return { tipo: "Delivery" };
      if (msg.includes("levar") || msg.includes("buscar") || msg.includes("retirar") || msg.includes("takeaway"))
        return { tipo: "Takeaway" };
      if (msg.includes("local") || msg.includes("mesa") || msg.includes("comer ai") || msg.includes("ai mesmo"))
        return { tipo: "Dine-in" };
      return null;

    case "PERGUNTAR_MORADA":
      // Simply return the message as the address if it's at least 5 characters
      return msg.length >= 5 ? { morada: message.trim() } : null;

    case "PERGUNTAR_PAGAMENTO":
      if (msg.includes("pix")) return { pagamento: "Pix" };
      if (msg.includes("cartao") || msg.includes("credito") || msg.includes("debito"))
        return { pagamento: "Cartão" };
      if (msg.includes("dinheiro") || msg.includes("cash"))
        return { pagamento: "Dinheiro" };
      return null;

    case "CONFIRMAR":
      const positive = ["sim", "s", "ok", "confirmo", "pode", "fechado", "quero", "isso", "isso mesmo", "confirmar"];
      const negative = ["nao", "não", "n", "cancelar", "cancela", "errado"];
      if (positive.some(p => msg.includes(p))) return { confirmado: true };
      if (negative.some(n => msg.includes(n))) return { confirmado: false };
      return null;

    default:
      return null;
  }
}

module.exports = { classifyMessage };