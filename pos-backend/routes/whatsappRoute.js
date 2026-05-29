// routes/whatsappRoute.js
// Refactored: uses state-machine step handlers, shared helpers, no inline logic.

const express = require("express");
const axios = require("axios");
const Order = require("../models/orderModel");
const { parseWhatsAppOrderWithLLM } = require("../utils/llmParser");
const { parseOrderByKeywords } = require("../utils/keywordParser");
const { getSession, updateSession, clearSession } = require("../utils/sessionManager");
const { getMenuData } = require("../utils/menuCache");
const { normalizeOrderText } = require("../utils/orderNormalizer");
const {
  extractOrderType,
  extractPayment,
  extractAddress,
  isWeakAddress,
  extractMacarraoParts,
  classifyStep,
  getCasualReply,
  buildOrderSummary,
} = require("../utils/whatsappHelpers");

const router = express.Router();

// ─────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────
const processedDeliveries = new Set();
const processedMessageIds = new Set();
const MAX_DELIVERY_CACHE = 100;
const MAX_MSGID_CACHE = 500;

function isDuplicate(deliveryId, messageId) {
  if (deliveryId && processedDeliveries.has(deliveryId)) {
    console.log(`🔄 Duplicate delivery ignored: ${deliveryId}`);
    return true;
  }
  if (deliveryId) {
    processedDeliveries.add(deliveryId);
    if (processedDeliveries.size > MAX_DELIVERY_CACHE) {
      processedDeliveries.delete(processedDeliveries.keys().next().value);
    }
  }
  if (messageId && processedMessageIds.has(messageId)) {
    console.log(`🔄 Duplicate message ID ignored: ${messageId}`);
    return true;
  }
  if (messageId) {
    processedMessageIds.add(messageId);
    if (processedMessageIds.size > MAX_MSGID_CACHE) {
      processedMessageIds.delete(processedMessageIds.keys().next().value);
    }
  }
  return false;
}

// ─────────────────────────────────────────────
// WhatsApp send helpers
// ─────────────────────────────────────────────
const OPENWA_BASE = () => process.env.OPENWA_URL || "http://localhost:2785";
const OPENWA_KEY = () => process.env.OPENWA_API_KEY || "dev-admin-key";

async function sendTyping(chatId, sessionId) {
  try {
    await axios.post(
      `${OPENWA_BASE()}/api/sessions/${sessionId}/messages/send-typing`,
      { chatId },
      { headers: { "X-API-Key": OPENWA_KEY() } }
    );
  } catch (_) {}
}

async function sendWhatsAppReply(chatId, text, sessionId) {
  const sid = sessionId || "default";
  try {
    await axios.post(
      `${OPENWA_BASE()}/api/sessions/${sid}/messages/send-text`,
      { chatId, text },
      { headers: { "X-API-Key": OPENWA_KEY() } }
    );
  } catch (error) {
    console.error("Erro ao enviar resposta:", error.message);
  }
}

async function sendMenuImage(chatId, sessionId) {
  try {
    const sid = sessionId || "default";
    // ✅ FIX: URL now comes from .env (add MENU_IMAGE_URL=http://... to your .env file)
    const imageUrl = process.env.MENU_IMAGE_URL || "http://localhost:3000/public/images/cardapio.jpeg";

    await axios.post(
      `${OPENWA_BASE()}/api/sessions/${sid}/messages/send-image`,
      { chatId, url: imageUrl, caption: "Aqui está o nosso cardápio! 🍔📋" },
      { headers: { "Content-Type": "application/json", "X-API-Key": OPENWA_KEY() } }
    );
    console.log("✅ Cardápio enviado com sucesso");
    return true;
  } catch (err) {
    console.error("❌ Erro ao enviar cardápio:", err.response?.data || err.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// Levenshtein (for fuzzy addition matching)
// ─────────────────────────────────────────────
function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  const m = Array.from({ length: an + 1 }, () => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i++) m[i][0] = i;
  for (let j = 0; j <= bn; j++) m[0][j] = j;
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[an][bn];
}

// ─────────────────────────────────────────────
// Fuzzy addition enrichment
// ─────────────────────────────────────────────
function enrichWithAdditions(parsedItems, rawMessage, products, additions) {
  const normalizedMessage = rawMessage
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const messageWords = normalizedMessage.split(" ");
  const allProductNames = products.map((p) =>
    p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  );
  const synonyms = { ovo: "egg", egg: "ovo", queijo: "cheese", cheese: "queijo", presunto: "ham", ham: "presunto" };

  for (const add of additions) {
    const addNorm = add.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (parsedItems.some((item) => (item.additions || []).some((a) => a.name === add.name))) continue;
    if (allProductNames.some((name) => name.includes(addNorm))) continue;

    let bestTokenIndex = -1, bestDist = Infinity;
    for (let i = 0; i < messageWords.length; i++) {
      const token = messageWords[i];
      if (token.length < 3) continue;
      const synToken = synonyms[token] || token;
      const dist = Math.min(levenshtein(token, addNorm), levenshtein(synToken, addNorm));
      if (dist <= 2 && dist < bestDist) { bestDist = dist; bestTokenIndex = i; }
    }
    if (bestTokenIndex < 0) continue;
    if (bestTokenIndex > 0 && messageWords[bestTokenIndex - 1] === "sem") continue;

    let closestItem = null;
    for (const item of parsedItems) {
      const itemNorm = item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const itemWords = itemNorm.split(" ");
      let lastIdx = -1;
      for (let i = 0; i < bestTokenIndex; i++) {
        if (messageWords[i] === itemWords[0]) lastIdx = i;
      }
      if (lastIdx >= 0 && (closestItem === null || (bestTokenIndex - lastIdx) < (closestItem._dist || Infinity))) {
        closestItem = item;
        closestItem._dist = bestTokenIndex - lastIdx;
      }
    }
    if (closestItem) {
      delete closestItem._dist;
      if (!closestItem.additions) closestItem.additions = [];
      closestItem.additions.push({ name: add.name, price: add.price });
    }
  }
  return parsedItems;
}

// ─────────────────────────────────────────────
// State machine: step handlers
// Each handler receives (ctx) and returns early or falls through.
// ─────────────────────────────────────────────

const stepHandlers = {

  // ── CLARIFICAR_MACARRAO ──────────────────────────────────────────────────
  async CLARIFICAR_MACARRAO(ctx) {
    const { phone, from, rawMessage, sessionId, session } = ctx;
    const parts = extractMacarraoParts(rawMessage);
    const typeGiven = parts.type;
    const sizeGiven = parts.size;

    const finalType = typeGiven || session.macarraoType;
    const finalSize = sizeGiven;

    if (!finalType) {
      await sendWhatsAppReply(from, "Qual tipo de macarrão? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
      updateSession(phone, { macarraoMissing: "type" });
      return true; // handled
    }
    if (!finalSize) {
      await sendWhatsAppReply(from, "E o tamanho? 📏\n• P (pequeno)\n• G (grande)", sessionId);
      updateSession(phone, { macarraoType: finalType, macarraoMissing: "size" });
      return true;
    }

    const productName = `Macarrão ${finalType.charAt(0).toUpperCase() + finalType.slice(1)} ${finalSize.toUpperCase()}`;
    const { products } = await getMenuData();
    const product = products.find((p) => p.name === productName);

    if (!product) {
      await sendWhatsAppReply(from, "Desculpe, esse prato não está disponível. Por favor, escolha outro.", sessionId);
      clearSession(phone);
      return true;
    }

    const newItem = { name: product.name, price: product.price, quantity: 1, observation: "", additions: [] };
    const currentItems = (session.pendingItems || []).concat(newItem);

    updateSession(phone, {
      step: "RECEBER_ITENS",
      items: currentItems,
      skipParsing: true,
      macarraoType: null,
      macarraoMissing: null,
      pendingItems: null,
    });
    return false; // fall through to RECEBER_ITENS
  },

  // ── INICIO ───────────────────────────────────────────────────────────────
  async INICIO(ctx) {
    const { phone, from, rawMessage, sessionId } = ctx;
    const { products, additions } = await getMenuData();
    const orderMsg = normalizeOrderText(rawMessage);
    const parsed = parseOrderByKeywords(orderMsg, products, additions);

    if (parsed && parsed.items.length > 0) {
      const lowerRaw = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const hasMacarraoMention = /\bmacarrao\b/.test(lowerRaw) || /\bmac\b/.test(lowerRaw);
      const hasMacarraoInItems = parsed.items.some((item) => item.name.toLowerCase().includes("macarrão"));

      if (hasMacarraoMention && !hasMacarraoInItems) {
        updateSession(phone, { step: "CLARIFICAR_MACARRAO", pendingItems: parsed.items, macarraoType: null, macarraoMissing: "type" });
        await sendWhatsAppReply(from, "Qual tipo de macarrão? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
        return true;
      }

      const extType = extractOrderType(rawMessage);
      const extAddr = extractAddress(rawMessage);
      const extPay = extractPayment(rawMessage);
      const updates = { step: "RECEBER_ITENS", items: parsed.items };
      if (extType) updates.orderType = extType;
      if (extAddr && extType === "Delivery") updates.address = extAddr;
      if (extPay) updates.payment = extPay;
      updateSession(phone, updates);
      return false; // fall through to RECEBER_ITENS
    }

    const lowerRaw = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/\bmacarrao\b/.test(lowerRaw) || /\bmac\b/.test(lowerRaw)) {
      updateSession(phone, { step: "CLARIFICAR_MACARRAO", macarraoType: null, macarraoMissing: "both", pendingItems: [] });
      await sendWhatsAppReply(from, "Qual tipo de macarrão você gostaria? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
      return true;
    }

    await sendWhatsAppReply(from, "🍔 Pode me enviar seu pedido (ex: 2 X-Bacon, 1 Coca-Cola) que eu anoto tudo!", sessionId);
    updateSession(phone, { step: "RECEBER_ITENS" });
    return true;
  },

  // ── RECEBER_ITENS ─────────────────────────────────────────────────────────
  async RECEBER_ITENS(ctx) {
    const { phone, from, rawMessage, sessionId, session } = ctx;
    const { products, additions } = await getMenuData();

    let parsed = null;

    if (!session.skipParsing) {
      const orderMsg = normalizeOrderText(rawMessage);
      parsed = parseOrderByKeywords(orderMsg, products, additions);
      if (!parsed || !parsed.items || parsed.items.length === 0) {
        console.log("Keyword parser found nothing, trying LLM…");
        try { parsed = await parseWhatsAppOrderWithLLM(rawMessage, products, additions); } catch (_) { parsed = null; }
      }
    } else {
      parsed = { order: true, items: session.items || [] };
      updateSession(phone, { skipParsing: false });
    }

    if (!parsed || parsed.order === false || !parsed.items || parsed.items.length === 0) {
      const lowerMsg = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (/\bmacarrao\b/.test(lowerMsg) || /\bmac\b/.test(lowerMsg)) {
        const parts = extractMacarraoParts(rawMessage);
        if (!parts.type && !parts.size) {
          updateSession(phone, { step: "CLARIFICAR_MACARRAO", macarraoType: null, macarraoMissing: "both", pendingItems: [] });
          await sendWhatsAppReply(from, "Qual tipo de macarrão você gostaria? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
        } else if (!parts.size) {
          updateSession(phone, { step: "CLARIFICAR_MACARRAO", macarraoType: parts.type, macarraoMissing: "size", pendingItems: [] });
          await sendWhatsAppReply(from, "E o tamanho? 📏\n• P (pequeno)\n• G (grande)", sessionId);
        } else {
          updateSession(phone, { step: "CLARIFICAR_MACARRAO", macarraoType: null, macarraoMissing: "type", pendingItems: [] });
          await sendWhatsAppReply(from, "Qual tipo de macarrão? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
        }
        return true;
      }
      const fallback = getCasualReply(rawMessage) || "Desculpe, não consegui entender. Pode tentar '2 X-Bacon, 1 Coca'?";
      await sendWhatsAppReply(from, fallback, sessionId);
      return true;
    }

    const lowerRaw = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const hasMacarraoMention = /\bmacarrao\b/.test(lowerRaw) || /\bmac\b/.test(lowerRaw);
    const hasMacarraoInItems = parsed.items.some((item) => item.name.toLowerCase().includes("macarrão"));

    if (hasMacarraoMention && !hasMacarraoInItems) {
      updateSession(phone, {
        step: "CLARIFICAR_MACARRAO",
        pendingItems: parsed.items.map((item) => ({
          name: item.name, price: item.price || 0, quantity: item.quantity || 1,
          observation: item.observation || "", additions: item.additions || [],
        })),
        macarraoType: null,
        macarraoMissing: "type",
      });
      await sendWhatsAppReply(from, "Qual tipo de macarrão? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
      return true;
    }

    // Enrich LLM items (no price) from menu
    parsed.items = parsed.items.map((item) => {
      if (item.price != null && item.price > 0) return item;
      const match = products.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
      return { ...item, price: match ? match.price : 0 };
    });

    // Fuzzy additions
    parsed.items = enrichWithAdditions(parsed.items, rawMessage, products, additions);

    const orderItems = parsed.items.map((item) => ({
      name: item.name, price: item.price || 0, quantity: item.quantity || 1,
      observation: item.observation || "", additions: item.additions || [],
    }));

    const updates = { items: orderItems };
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
    const hasType = !!sess.orderType;
    const hasPayment = !!sess.payment;
    const needAddr = sess.orderType === "Delivery";
    const hasAddr = needAddr ? !!sess.address : true;

    if (hasType && hasPayment && hasAddr) {
      updateSession(phone, { step: "CONFIRMAR" });
      const { total, tipo, itens } = buildOrderSummary(getSession(phone));
      await sendWhatsAppReply(from, `📝 Resumo do pedido:\n\n${itens}\n\n🏷️ ${tipo}\n💳 ${sess.payment}\n💰 Total: R$ ${total.toFixed(2)}\n\nConfirma? (sim / não)`, sessionId);
      return true;
    }

    if (!hasType) {
      updateSession(phone, { step: "PERGUNTAR_TIPO" });
      await sendWhatsAppReply(from, "📋 Itens registados! Como deseja receber o pedido?\n1️⃣ Para levar\n2️⃣ Entrega\n3️⃣ No local", sessionId);
    } else if (needAddr && !hasAddr) {
      const partialAddr = extractAddress(rawMessage) || rawMessage.trim();
      if (isWeakAddress(partialAddr)) {
        updateSession(phone, { step: "PERGUNTAR_MORADA_DETALHES", address: partialAddr });
        await sendWhatsAppReply(from, `🏠 Encontrei: "${partialAddr}". Pode me informar o número da casa/apartamento ou mais detalhes?`, sessionId);
      } else {
        updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: partialAddr });
        await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
      }
    } else if (!hasPayment) {
      updateSession(phone, { step: "PERGUNTAR_PAGAMENTO" });
      await sendWhatsAppReply(from, "💳 Qual a forma de pagamento?\n1️⃣ Dinheiro\n2️⃣ Cartão\n3️⃣ Pix", sessionId);
    }
    return true;
  },

  // ── PERGUNTAR_TIPO ───────────────────────────────────────────────────────
  async PERGUNTAR_TIPO(ctx) {
    const { phone, from, rawMessage, sessionId } = ctx;
    const cl = classifyStep("PERGUNTAR_TIPO", rawMessage);
    if (!cl) {
      await sendWhatsAppReply(from, "Não entendi. Pode me dizer se quer para levar, entrega ou no local?", sessionId);
      return true;
    }
    updateSession(phone, { orderType: cl.tipo });
    if (cl.tipo === "Delivery") {
      updateSession(phone, { step: "PERGUNTAR_MORADA" });
      await sendWhatsAppReply(from, "🏠 Qual o endereço completo para entrega?\nExemplo: Rua das Flores, 123, apto 2", sessionId);
    } else {
      updateSession(phone, { step: "PERGUNTAR_PAGAMENTO" });
      await sendWhatsAppReply(from, "💳 Qual a forma de pagamento?\n1️⃣ Dinheiro\n2️⃣ Cartão\n3️⃣ Pix", sessionId);
    }
    return true;
  },

  // ── PERGUNTAR_MORADA ─────────────────────────────────────────────────────
  async PERGUNTAR_MORADA(ctx) {
    const { phone, from, rawMessage, sessionId } = ctx;
    const addr = extractAddress(rawMessage) || rawMessage.trim();
    if (isWeakAddress(addr)) {
      updateSession(phone, { step: "PERGUNTAR_MORADA_DETALHES", address: addr });
      await sendWhatsAppReply(from, `🏠 Entendi "${addr}". Pode me informar o número da casa/apartamento ou um complemento?`, sessionId);
    } else {
      updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: addr });
      await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
    }
    return true;
  },

  // ── PERGUNTAR_MORADA_DETALHES ────────────────────────────────────────────
  async PERGUNTAR_MORADA_DETALHES(ctx) {
    const { phone, from, rawMessage, sessionId, session } = ctx;
    const detail = rawMessage.trim();
    const fullAddress = `${session.address || ""} ${detail}`.trim();
    updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: fullAddress });
    await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
    return true;
  },

  // ── PERGUNTAR_PAGAMENTO ──────────────────────────────────────────────────
  async PERGUNTAR_PAGAMENTO(ctx) {
    const { phone, from, rawMessage, sessionId } = ctx;
    const pay = extractPayment(rawMessage) || classifyStep("PERGUNTAR_PAGAMENTO", rawMessage)?.pagamento;
    if (!pay) {
      await sendWhatsAppReply(from, "Não entendi a forma de pagamento. Pode escolher Dinheiro, Cartão ou Pix?", sessionId);
      return true;
    }
    updateSession(phone, { payment: pay, step: "CONFIRMAR" });
    const sess = getSession(phone);
    const { total, tipo, itens } = buildOrderSummary(sess);
    await sendWhatsAppReply(from, `📝 Resumo do pedido:\n\n${itens}\n\n🏷️ ${tipo}\n💳 ${pay}\n💰 Total: R$ ${total.toFixed(2)}\n\nConfirma? (sim / não)`, sessionId);
    return true;
  },

  // ── CONFIRMAR ────────────────────────────────────────────────────────────
  async CONFIRMAR(ctx) {
    const { phone, from, rawMessage, sessionId, contact } = ctx;
    const cl = classifyStep("CONFIRMAR", rawMessage);

    if (cl?.confirmado === true) {
      const sess = getSession(phone);
      const { total } = buildOrderSummary(sess);
      try {
        const newOrder = new Order({
          customerDetails: { name: contact?.name || "Cliente WhatsApp", phone, guests: 1 },
          orderType: sess.orderType || "Takeaway",
          deliveryAddress: sess.orderType === "Delivery" ? sess.address : undefined,
          table: null,
          isStanding: sess.orderType === "Dine-in",
          orderStatus: "Pending",
          bills: { total, tax: 0, totalWithTax: total },
          items: sess.items,
          paymentMethod: sess.payment,
          paymentStatus: "Pending",
        });
        await newOrder.save();
        await sendWhatsAppReply(from, `✅ Pedido #${String(newOrder._id).slice(-6)} confirmado! Já estamos preparando. Obrigado pela preferência! 🍔`, sessionId);
      } catch (err) {
        console.error("Erro ao criar pedido:", err);
        await sendWhatsAppReply(from, "Houve um problema ao criar o seu pedido. Por favor, tente novamente.", sessionId);
      }
      clearSession(phone);
    } else if (cl?.confirmado === false) {
      updateSession(phone, { step: "RECEBER_ITENS", items: [], orderType: null, address: "", payment: null, pendingItems: null, skipParsing: false });
      await sendWhatsAppReply(from, "Sem problema! 😊 O que gostaria de alterar? Pode me enviar o novo pedido.", sessionId);
    } else {
      await sendWhatsAppReply(from, "Por favor, responda *sim* para confirmar ou *não* para alterar o pedido.", sessionId);
    }
    return true;
  },
};

// ─────────────────────────────────────────────
// MAIN WEBHOOK
// ─────────────────────────────────────────────
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

    // ---- Casual / greeting intercept ----
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

    // ---- Cancel command ----
    if (rawMessage.toLowerCase() === "cancelar") {
      clearSession(phone);
      await sendWhatsAppReply(from, "Pedido cancelado. Se precisar de algo mais, é só pedir! 🙂", sessionId);
      return res.json({ status: "cancelled" });
    }

    // ---- Build context object for step handlers ----
    let session = getSession(phone);
    const ctx = { phone, from, rawMessage, sessionId, session, contact };

    // ---- State machine: run the current step handler, then fall through if needed ----
    const stepsToRun = [session.step, "RECEBER_ITENS"];
    const visited = new Set();

    for (const step of stepsToRun) {
      if (visited.has(step)) break;
      visited.add(step);

      const handler = stepHandlers[step];
      if (!handler) break;

      // Refresh session before each handler (it may have been updated by prior handler)
      ctx.session = getSession(phone);
      const handled = await handler(ctx);
      if (handled) break;
    }

    return res.json({ status: "ok" });
  } catch (error) {
    console.error("Erro no webhook WhatsApp:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;