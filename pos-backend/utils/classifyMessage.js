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
      // Number shortcuts (1/2/3) + keywords
      if (msg === "1" || msg.includes("entrega") || msg.includes("delivery") || msg.includes("entregar"))
        return { tipo: "Delivery" };
      if (msg === "2" || msg.includes("levar") || msg.includes("buscar") || msg.includes("retirar") || msg.includes("takeaway"))
        return { tipo: "Takeaway" };
      if (msg === "3" || msg.includes("local") || msg.includes("mesa") || msg.includes("comer ai") || msg.includes("ai mesmo") || msg.includes("pe"))
        return { tipo: "Dine-in" };
      return null;

    case "PERGUNTAR_MORADA":
      return msg.length >= 5 ? { morada: message.trim() } : null;

    case "PERGUNTAR_PAGAMENTO":
      // Number shortcuts (1/2/3) + keywords
      if (msg === "1" || msg.includes("dinheiro") || msg.includes("cash"))
        return { pagamento: "Dinheiro" };
      if (msg === "2" || msg.includes("cartao") || msg.includes("credito") || msg.includes("debito"))
        return { pagamento: "Cartão" };
      if (msg === "3" || msg.includes("pix"))
        return { pagamento: "Pix" };
      return null;

    case "CONFIRMAR": {
      const positive = ["sim", "s", "ok", "confirmo", "pode", "fechado", "quero", "isso", "isso mesmo", "confirmar", "vai", "bora"];
      const negative = ["nao", "não", "n", "cancelar", "cancela", "errado", "alterar", "mudar", "trocar"];
      if (positive.some(p => msg === p || msg.includes(p))) return { confirmado: true };
      if (negative.some(n => msg === n || msg.includes(n))) return { confirmado: false };
      return null;
    }

    default:
      return null;
  }
}

module.exports = { classifyMessage };