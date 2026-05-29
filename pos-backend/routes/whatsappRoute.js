const express = require("express");
const axios = require("axios");
const Order = require("../models/orderModel");
const { parseWhatsAppOrderWithLLM } = require("../utils/llmParser");
const { parseOrderByKeywords } = require("../utils/keywordParser");
const { getSession, updateSession, clearSession } = require("../utils/sessionManager");
const { getMenuData } = require("../utils/menuCache");
const { normalizeOrderText } = require("../utils/orderNormalizer");

const router = express.Router();

// ---------- deduplication ----------
const processedDeliveries = new Set();
const MAX_DELIVERY_CACHE = 100;
const processedMessageIds = new Set();
const MAX_MSGID_CACHE = 500;

function isDuplicate(deliveryId, messageId) {
  if (deliveryId && processedDeliveries.has(deliveryId)) { console.log(`🔄 Duplicate delivery ignored: ${deliveryId}`); return true; }
  if (deliveryId) {
    processedDeliveries.add(deliveryId);
    if (processedDeliveries.size > MAX_DELIVERY_CACHE) { const firstKey = processedDeliveries.keys().next().value; processedDeliveries.delete(firstKey); }
  }
  if (messageId && processedMessageIds.has(messageId)) { console.log(`🔄 Duplicate message ID ignored: ${messageId}`); return true; }
  if (messageId) {
    processedMessageIds.add(messageId);
    if (processedMessageIds.size > MAX_MSGID_CACHE) { const firstKey = processedMessageIds.keys().next().value; processedMessageIds.delete(firstKey); }
  }
  return false;
}

// ---------- send helpers ----------
async function sendTyping(chatId, sessionId) {
  try { await axios.post(`http://localhost:2785/api/sessions/${sessionId}/messages/send-typing`, { chatId }, { headers: { "X-API-Key": process.env.OPENWA_API_KEY || "dev-admin-key" } }); } catch (e) {}
}
async function sendWhatsAppReply(chatId, text, sessionId) {
  const sid = sessionId || "default";
  try { await axios.post(`http://localhost:2785/api/sessions/${sid}/messages/send-text`, { chatId, text }, { headers: { "X-API-Key": process.env.OPENWA_API_KEY || "dev-admin-key" } }); } catch (error) { console.error("Erro ao enviar resposta:", error.message); }
}

// ---------- menu image (uses your working URL) ----------
async function sendMenuImage(chatId, sessionId) {
  try {
    const sid = sessionId || "default";
    const imageUrl = "http://10.33.14.193:3000/public/images/cardapio.jpeg";

    await axios.post(
      `http://localhost:2785/api/sessions/${sid}/messages/send-image`,
      {
        chatId,
        url: imageUrl,
        caption: "Aqui está o nosso cardápio! 🍔📋",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.OPENWA_API_KEY || "dev-admin-key",
        },
      }
    );

    console.log("✅ Cardápio enviado com sucesso");
    return true;
  } catch (err) {
    console.error("❌ Erro ao enviar cardápio:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data));
    } else {
      console.error(err.message);
    }
    return false;
  }
}

// ---------- classification helpers ----------
function simpleClassify(step, message) {
  const msg = message.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  switch (step) {
    case "PERGUNTAR_TIPO":
      if (msg.includes("levar") || msg === "1") return { tipo: "Takeaway" };
      if (msg.includes("entrega") || msg === "2") return { tipo: "Delivery" };
      if (msg.includes("local") || msg.includes("mesa") || msg.includes("pe") || msg === "3") return { tipo: "Dine-in" };
      return null;
    case "PERGUNTAR_PAGAMENTO":
      if (msg.includes("dinheiro") || msg === "1") return { pagamento: "Dinheiro" };
      if (msg.includes("cartao") || msg === "2") return { pagamento: "Cartão" };
      if (msg.includes("pix") || msg === "3") return { pagamento: "Pix" };
      return null;
    case "CONFIRMAR":
      const pos = ["sim", "s", "ok", "confirmo", "pode", "fechado", "quero", "isso", "isso mesmo", "confirmar"];
      const neg = ["nao", "não", "n", "cancelar", "cancela", "errado"];
      if (pos.some(p => msg.includes(p))) return { confirmado: true };
      if (neg.some(n => msg.includes(n))) return { confirmado: false };
      return null;
    default: return null;
  }
}

function getCasualReply(msg) {
  const lower = msg.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("como") && /(vai|esta|estas|ta|tas|tao|vao|passando|passa|anda)\b/.test(lower)) return "Estou ótimo, obrigado! 🍔 Como posso ajudar? Faça o seu pedido e eu trato de tudo!";
  if (lower.match(/tudo bem|tudo certo|tudo joia|tranquilo|beleza|salve|fala/)) return "Estou ótimo, obrigado! 🍔 Como posso ajudar? Faça o seu pedido e eu trato de tudo!";
  if (lower.includes("cardapio") || lower.includes("menu")) return "cardapio";
  if (lower.includes("preco") || lower.includes("quanto") || lower.includes("custa")) return "Os preços variam conforme o item. Pode consultar o cardápio ou pedir diretamente que eu informo o total!";
  if (lower.includes("horario") || lower.includes("abre") || lower.includes("fecha")) return "Estamos abertos todos os dias das 18h às 23h.";
  if (lower.match(/bom dia|boa tarde|boa noite|oi|ola|oii|hey/)) return "Olá! 🍔 Como posso ajudar? Faça o seu pedido e eu trato de tudo!";
  return null;
}

// ---------- Address helpers ----------
function extractAddress(msg) {
  const text = msg.trim();
  const patterns = [
    /(?:rua|avenida|av\.|travessa|trv\.|alameda|rodovia|estrada)\s+[\w\s\-]+?,?\s*\d+/i,
    /(?:rua|avenida|av\.)\s+[\w\s\-]+/i,
    /\b(?:casa|apto|apartamento|bloco|bl|fundos|lote)\s*\w+/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function isWeakAddress(addr) {
  if (!addr) return true;
  const normalized = addr.toLowerCase();
  if (normalized.length < 10) return true;
  if (!/\d/.test(normalized)) return true;
  return false;
}

function extractOrderType(msg) {
  const lower = msg.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(vou|vo|vô|vou)\s*(busca|buscar|retira|retirar|levanta|levantar|pega|pegar|passa|passar)\b/.test(lower)) return "Takeaway";
  if (lower.includes("entrega") || lower.includes("delivery") || lower.includes("entregar")) return "Delivery";
  if (lower.includes("levar") || lower.includes("takeaway")) return "Takeaway";
  if (lower.includes("local") || lower.includes("mesa") || lower.includes("pe")) return "Dine-in";
  return null;
}

function extractPayment(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes("pix")) return "Pix";
  if (lower.includes("cartao") || lower.includes("cartão")) return "Cartão";
  if (lower.includes("dinheiro")) return "Dinheiro";
  return null;
}

// ---------- MAIN WEBHOOK ----------
router.post("/webhook", async (req, res) => {
  try {
    const { event, data, sessionId, deliveryId } = req.body;
    const messageId = data?.id;
    if (isDuplicate(deliveryId, messageId)) return res.json({ status: "duplicate" });
    if (event !== "message.received") return res.json({ status: "ignored" });

    const { from, body, contact } = data;
    const phone = from.replace("@c.us", "").replace("@lid", "");
    const rawMessage = (body || "").trim();
    if (!rawMessage) return res.json({ status: "empty_message" });

    console.log(`📩 WhatsApp de ${contact?.name || phone}: "${rawMessage}"`);
    await sendTyping(from, sessionId);

    // ---- early casual reply ----
    const casualReply = getCasualReply(rawMessage);
    if (casualReply) {
      if (casualReply === "cardapio") {
        const sent = await sendMenuImage(from, sessionId);
        if (!sent) await sendWhatsAppReply(from, "Desculpe, não consegui enviar a imagem do cardápio agora. Tente novamente em instantes! 🙏", sessionId);
      } else {
        await sendWhatsAppReply(from, casualReply, sessionId);
      }
      return res.json({ status: "ok" });
    }

    // cancel command
    if (rawMessage.toLowerCase() === "cancelar") {
      clearSession(phone);
      await sendWhatsAppReply(from, "Pedido cancelado. Se precisar de algo mais, é só pedir! 🙂", sessionId);
      return res.json({ status: "cancelled" });
    }

    let session = getSession(phone);

    // ========== INICIO ==========
    if (session.step === "INICIO") {
      const { products, additions } = await getMenuData();
      const orderMsg = normalizeOrderText(rawMessage);
      const parsed = parseOrderByKeywords(orderMsg, products, additions);
      if (parsed && parsed.items.length > 0) {
        const extType = extractOrderType(rawMessage);
        const extAddr = extractAddress(rawMessage);
        const extPay = extractPayment(rawMessage);
        const updates = { step: "RECEBER_ITENS", items: parsed.items };
        if (extType) updates.orderType = extType;
        // Only set address if a real delivery keyword was also found
        if (extAddr && extType === "Delivery") updates.address = extAddr;
        if (extPay) updates.payment = extPay;
        updateSession(phone, updates);
        session = getSession(phone);
      } else {
        await sendWhatsAppReply(from, "Olá! 🍔 Pode me enviar seu pedido (ex: 2 X-Bacon, 1 Coca-Cola) que eu trato de tudo!", sessionId);
        updateSession(phone, { step: "RECEBER_ITENS" });
        return res.json({ status: "ok" });
      }
    }

    // ========== RECEBER ITENS ==========
    if (session.step === "RECEBER_ITENS") {
      const { products, additions } = await getMenuData();
      const orderMsg = normalizeOrderText(rawMessage);

      let parsed = parseOrderByKeywords(orderMsg, products, additions);
      if (!parsed || !parsed.items || parsed.items.length === 0) {
        console.log("Keyword parser found nothing, trying LLM…");
        try {
          parsed = await parseWhatsAppOrderWithLLM(rawMessage, products, additions);
        } catch (e) { parsed = null; }
      }
      if (!parsed || parsed.order === false || !parsed.items || parsed.items.length === 0) {
        const fallback = getCasualReply(rawMessage) || "Desculpe, não consegui entender. Pode tentar '2 X-Bacon, 1 Coca'?";
        await sendWhatsAppReply(from, fallback, sessionId);
        return res.json({ status: "ok" });
      }

      // Enrich items that came from LLM (no price) with prices from the menu
      parsed.items = parsed.items.map(item => {
        if (item.price != null && item.price > 0) return item;
        const match = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        return { ...item, price: match ? match.price : 0 };
      });

      // Fuzzy additions (unchanged)
      const normalizedMessage = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const messageWords = normalizedMessage.split(" ");
      const allProductNames = products.map(p => p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim());
      const levenshtein = (a, b) => { const an = a.length, bn = b.length; const m = Array.from({ length: an + 1 }, () => Array(bn + 1).fill(0)); for (let i = 0; i <= an; i++) m[i][0] = i; for (let j = 0; j <= bn; j++) m[0][j] = j; for (let i = 1; i <= an; i++) { for (let j = 1; j <= bn; j++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost); } } return m[an][bn]; };
      const synonyms = { "ovo": "egg", "egg": "ovo", "queijo": "cheese", "cheese": "queijo", "bacon": "bacon", "presunto": "ham", "ham": "presunto" };
      const expandedProductNames = allProductNames.flatMap(name => { const words = name.split(" "); const syns = words.map(w => synonyms[w] || w); return [name, ...syns.join(" ")]; });

      for (const add of additions) {
        const addNorm = add.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (parsed.items.some(item => (item.additions || []).some(a => a.name === add.name))) continue;
        // Only skip if the addition's OWN name is part of a product name.
        // Do NOT use synonyms here: 'ovo' must not be skipped just because X-Egg exists.
        if (allProductNames.some(name => name.includes(addNorm))) { console.log(`Skipping addition "${add.name}" - already implied by product`); continue; }

        let bestTokenIndex = -1, bestDist = Infinity;
        for (let i = 0; i < messageWords.length; i++) {
          const token = messageWords[i];
          if (token.length < 3) continue;
          const dist = levenshtein(token, addNorm);
          if (dist <= 2 && dist < bestDist) { bestDist = dist; bestTokenIndex = i; }
        }
        if (bestTokenIndex < 0) continue;
        if (bestTokenIndex > 0 && messageWords[bestTokenIndex - 1] === "sem") { console.log(`Skipping addition "${add.name}" – preceded by "sem"`); continue; }

        let closestItem = null;
        for (const item of parsed.items) {
          const itemNorm = item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const itemWords = itemNorm.split(" ");
          let lastIdx = -1;
          for (let i = 0; i < bestTokenIndex; i++) { if (messageWords[i] === itemWords[0]) lastIdx = i; }
          if (lastIdx >= 0 && (closestItem === null || (bestTokenIndex - lastIdx) < (closestItem._dist || Infinity))) { closestItem = item; closestItem._dist = bestTokenIndex - lastIdx; }
        }
        if (closestItem) { delete closestItem._dist; if (!closestItem.additions) closestItem.additions = []; closestItem.additions.push({ name: add.name, price: add.price }); }
      }

      const orderItems = parsed.items.map(item => ({
        name: item.name, price: item.price || 0, quantity: item.quantity || 1,
        observation: item.observation || "", additions: item.additions || []
      }));

      const updates = { items: orderItems };

      // Only extract orderType/address/payment if not already set in session.
      // Prevents food descriptions (e.g. '1 lacador com ovo') from being
      // misread as an address or order type when the customer is editing.
      const sess0 = getSession(phone);
      if (!sess0.orderType) {
        let extType = extractOrderType(rawMessage);
        const extAddr = extractAddress(rawMessage);
        if (!extType && extAddr) extType = "Delivery";
        if (extType) updates.orderType = extType;
        if (extAddr) updates.address = extAddr;
      }
      if (!sess0.payment) {
        const extPay = extractPayment(rawMessage);
        if (extPay) updates.payment = extPay;
      }

      updateSession(phone, updates);

      const sess = getSession(phone);
      const hasType = !!sess.orderType, hasPayment = !!sess.payment;
      const needAddr = sess.orderType === "Delivery", hasAddr = needAddr ? !!sess.address : true;

      if (hasType && hasPayment && hasAddr) {
        updateSession(phone, { step: "CONFIRMAR" });
        const total = sess.items.reduce((sum, item) => { const addPrice = (item.additions || []).reduce((s, a) => s + (a.price || 0), 0); return sum + ((item.price + addPrice) * (item.quantity || 1)); }, 0);
        let tipo = sess.orderType === "Dine-in" ? "No local (Em pé)" : sess.orderType === "Delivery" ? `Entrega em ${sess.address || "?"}` : "Para levar";
        const itens = sess.items.map(i => { let line = `${i.quantity}x ${i.name}`; if (i.additions?.length) line += ` (+ ${i.additions.map(a => a.name).join(", ")})`; return line; }).join("\n");
        await sendWhatsAppReply(from, `📝 Resumo do pedido:\n\n${itens}\n\n🏷️ ${tipo}\n💳 ${sess.payment}\n💰 Total: R$ ${total.toFixed(2)}\n\nConfirma? (sim / não)`, sessionId);
        return res.json({ status: "ok" });
      }
      if (!hasType) { updateSession(phone, { step: "PERGUNTAR_TIPO" }); await sendWhatsAppReply(from, "📋 Itens registados! Como deseja receber o pedido?\n• Para levar\n• Entrega\n• No local", sessionId); }
      else if (needAddr && !hasAddr) {
        const partialAddr = extractAddress(rawMessage) || rawMessage.trim();
        if (isWeakAddress(partialAddr)) {
          updateSession(phone, { step: "PERGUNTAR_MORADA_DETALHES", address: partialAddr });
          await sendWhatsAppReply(from, `🏠 Encontrei: "${partialAddr}". Pode me informar o número da casa/apartamento ou mais detalhes?`, sessionId);
        } else {
          updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: partialAddr });
          await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
        }
      }
      else if (!hasPayment) { updateSession(phone, { step: "PERGUNTAR_PAGAMENTO" }); await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId); }
      return res.json({ status: "ok" });
    }

    // ========== PERGUNTAR_TIPO ==========
    if (session.step === "PERGUNTAR_TIPO") {
      const cl = simpleClassify("PERGUNTAR_TIPO", rawMessage);
      if (!cl) { await sendWhatsAppReply(from, "Não entendi. Pode me dizer se quer para levar, entrega ou no local?", sessionId); return res.json({ status: "ok" }); }
      updateSession(phone, { orderType: cl.tipo });
      if (cl.tipo === "Delivery") { updateSession(phone, { step: "PERGUNTAR_MORADA" }); await sendWhatsAppReply(from, "🏠 Qual o endereço completo para entrega?\nExemplo: Rua das Flores, 123, apto 2", sessionId); }
      else { updateSession(phone, { step: "PERGUNTAR_PAGAMENTO" }); await sendWhatsAppReply(from, "💳 Qual a forma de pagamento?", sessionId); }
      return res.json({ status: "ok" });
    }

    // ========== PERGUNTAR_MORADA ==========
    if (session.step === "PERGUNTAR_MORADA") {
      const addr = extractAddress(rawMessage) || rawMessage.trim();
      if (isWeakAddress(addr)) {
        updateSession(phone, { step: "PERGUNTAR_MORADA_DETALHES", address: addr });
        await sendWhatsAppReply(from, `🏠 Entendi "${addr}". Pode me informar o número da casa/apartamento ou um complemento?`, sessionId);
      } else {
        updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: addr });
        await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
      }
      return res.json({ status: "ok" });
    }

    // ========== PERGUNTAR_MORADA_DETALHES ==========
    if (session.step === "PERGUNTAR_MORADA_DETALHES") {
      const detail = rawMessage.trim();
      const fullAddress = `${session.address || ""} ${detail}`.trim();
      if (isWeakAddress(fullAddress)) {
        await sendWhatsAppReply(from, `📬 Endereço registado como "${fullAddress}". Vamos prosseguir.`, sessionId);
      }
      updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: fullAddress });
      await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
      return res.json({ status: "ok" });
    }

    // ========== PERGUNTAR_PAGAMENTO ==========
    if (session.step === "PERGUNTAR_PAGAMENTO") {
      const pay = extractPayment(rawMessage) || (simpleClassify("PERGUNTAR_PAGAMENTO", rawMessage)?.pagamento);
      if (!pay) { await sendWhatsAppReply(from, "Não entendi a forma de pagamento. Pode escolher Dinheiro, Cartão ou Pix?", sessionId); return res.json({ status: "ok" }); }
      updateSession(phone, { payment: pay, step: "CONFIRMAR" });
      const sess = getSession(phone);
      const total = sess.items.reduce((sum, item) => { const addPrice = (item.additions || []).reduce((s, a) => s + (a.price || 0), 0); return sum + ((item.price + addPrice) * (item.quantity || 1)); }, 0);
      let tipo = sess.orderType === "Dine-in" ? "No local (Em pé)" : sess.orderType === "Delivery" ? `Entrega em ${sess.address || "?"}` : "Para levar";
      const itens = sess.items.map(i => { let line = `${i.quantity}x ${i.name}`; if (i.additions?.length) line += ` (+ ${i.additions.map(a => a.name).join(", ")})`; return line; }).join("\n");
      await sendWhatsAppReply(from, `📝 Resumo do pedido:\n\n${itens}\n\n🏷️ ${tipo}\n💳 ${pay}\n💰 Total: R$ ${total.toFixed(2)}\n\nConfirma? (sim / não)`, sessionId);
      return res.json({ status: "ok" });
    }

    // ========== CONFIRMAR ==========
    if (session.step === "CONFIRMAR") {
      const cl = simpleClassify("CONFIRMAR", rawMessage);
      if (cl?.confirmado === true) {
        const sess = getSession(phone);
        const totalOrder = sess.items.reduce((sum, item) => { const addPrice = (item.additions || []).reduce((s, a) => s + (a.price || 0), 0); return sum + ((item.price + addPrice) * (item.quantity || 1)); }, 0);
        try {
          const newOrder = new Order({ customerDetails: { name: contact?.name || "Cliente WhatsApp", phone, guests: 1 }, orderType: sess.orderType || "Takeaway", deliveryAddress: sess.orderType === "Delivery" ? sess.address : undefined, table: null, isStanding: sess.orderType === "Dine-in", orderStatus: "Pending", bills: { total: totalOrder, tax: 0, totalWithTax: totalOrder }, items: sess.items, paymentMethod: sess.payment, paymentStatus: "Pending" });
          await newOrder.save();
          await sendWhatsAppReply(from, `✅ Pedido #${String(newOrder._id).slice(-6)} confirmado! Já estamos preparando. Obrigado pela preferência! 🍔`, sessionId);
        } catch (err) { await sendWhatsAppReply(from, "Houve um problema ao criar o seu pedido. Por favor, tente novamente.", sessionId); }
        clearSession(phone);
      } else if (cl?.confirmado === false) {
        // Let the customer fix their order instead of starting over
        updateSession(phone, { step: "RECEBER_ITENS", items: [], orderType: null, address: "", payment: null });
        await sendWhatsAppReply(from, "Sem problema! 😊 O que gostaria de alterar? Pode me enviar o novo pedido.", sessionId);
      } else {
        // Didn't understand yes/no — ask again
        await sendWhatsAppReply(from, "Por favor, responda *sim* para confirmar ou *não* para alterar o pedido.", sessionId);
      }
      return res.json({ status: "ok" });
    }

    // Fallback — reset cleanly and prompt
    clearSession(phone);
    updateSession(phone, { step: "INICIO" });
    await sendWhatsAppReply(from, "Olá! Envia o teu pedido e eu ajudo. 🍔", sessionId);
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Erro no webhook WhatsApp:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;