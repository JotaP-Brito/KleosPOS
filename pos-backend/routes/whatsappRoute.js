// routes/whatsappRoute.js
// Refactored: uses state-machine step handlers, shared helpers, no inline logic.

const express = require("express");
const axios = require("axios");
const Order = require("../models/orderModel");
// const { parseWhatsAppOrderWithLLM } = require("../utils/llmParser");   // LLM disabled – kept for future use
const { parseOrderByKeywords } = require("../utils/keywordParser");
const { mergeParsedResults } = require("../utils/orderMerge");         // kept for future use
const {
  getSession,
  updateSession,
  clearSession,
  muteSession,
  unmuteSession,
} = require("../utils/sessionManager");
const { getMenuData } = require("../utils/menuCache");
const { normalizeOrderText } = require("../utils/orderNormalizer");
const crossSellUpsellConfig = require("../config/crossSellUpsell");
const {
  extractOrderType,
  extractPayment,
  extractAddress,
  isWeakAddress,
  extractMacarraoParts,
  classifyStep,
  getCasualReply,
  SEND_MENU,
  buildOrderSummary,
  getAdditionAlias,
  detectUnknownAddition,
  GENERIC_DRINK_WORDS,
  getDrinkOptions,
  needsDrinkDisambiguation,
} = require("../utils/whatsappHelpers");
const { updateCustomerRecord } = require("../utils/updateCustomer");
const { levenshtein } = require("../utils/stringUtils");
const botStatusRoute = require("../routes/botStatusRoute");
const router = express.Router();

// ─────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────
const processedDeliveries = new Set();
const processedMessageIds = new Set();
const MAX_DELIVERY_CACHE = 100;
const MAX_MSGID_CACHE = 500;
const sendWhatsAppMessage = require("../utils/sendWhatsAppMessage");

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
  } catch (_) { }
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
// Fuzzy addition enrichment (only used for LLM results – kept for future reference)
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

  const numberWords = new Set([
    "um", "uma", "dois", "duas", "tres", "três", "quatro", "cinco", "seis",
    "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze",
  ]);

  for (const add of additions) {
    const addNorm = add.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (parsedItems.some((item) => (item.additions || []).some((a) => a.name === add.name))) continue;
    if (allProductNames.some((name) => name.includes(addNorm))) continue;

    let bestTokenIndex = -1, bestDist = Infinity;
    for (let i = 0; i < messageWords.length; i++) {
      const token = messageWords[i];
      if (token.length < 3) continue;
      if (numberWords.has(token) || /^\d+$/.test(token)) continue;
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

// ETA in minutes by order type (configurable without touching handler logic)
const ETA_MINUTES = {
  Takeaway: process.env.ETA_TAKEAWAY || 15,
  "Dine-in": process.env.ETA_DINEIN || 20,
  Delivery: process.env.ETA_DELIVERY || 40,
};

function etaMessage(orderType) {
  const mins = ETA_MINUTES[orderType] || 30;
  return `\n\n⏱️ Previsão: ~${mins} minutos.`;
}

// ─────────────────────────────────────────────
// Helper: split on " e um/uma" only when the next word is not an addition trigger.
// ─────────────────────────────────────────────
const ADDITION_TRIGGER_WORDS = new Set([
  "com", "mais", "sem", "acrescimo", "extra", "adicional", "tambem", "e"
]);

function splitOnEUm(rawMessage) {
  const segments = [];
  const regex = /\s+e\s+(um\s+|uma\s+)/gi;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(rawMessage)) !== null) {
    const afterMatchIndex = match.index + match[0].length;
    const rest = rawMessage.slice(afterMatchIndex).trimStart();
    const nextWord = rest.split(/\s+/, 1)[0] || "";
    const normalizedNext = nextWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (ADDITION_TRIGGER_WORDS.has(normalizedNext)) {
      // This "e um" is part of an addition phrase – don't split
      continue;
    }
    segments.push(rawMessage.slice(lastIndex, match.index));
    lastIndex = afterMatchIndex;
  }
  segments.push(rawMessage.slice(lastIndex));
  return segments.filter(s => s.trim());
}

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
      return true;
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

    const segments = splitOnEUm(rawMessage);
    let allItems = [];
    for (const seg of segments) {
      const segMsg = seg.trim();
      if (!segMsg) continue;
      const segNormalized = normalizeOrderText(segMsg);
      const parsedSeg = parseOrderByKeywords(segNormalized, products, additions);
      if (parsedSeg && parsedSeg.items.length > 0) {
        allItems = allItems.concat(parsedSeg.items);
      }
    }

    const parsed = allItems.length > 0 ? { order: true, items: allItems, byKeyword: true } : null;

    if (parsed && parsed.items.length > 0) {
      const lowerRaw = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const hasMacarraoMention = /\b(macarrao|mac|espaguete|spaghetti|espagueti)\b/.test(lowerRaw);
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
      return false;
    }

    const lowerRaw = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/\b(macarrao|mac|espaguete|spaghetti|espagueti)\b/.test(lowerRaw)) {
      const parts = extractMacarraoParts(rawMessage);
      updateSession(phone, {
        step: "CLARIFICAR_MACARRAO",
        macarraoType: parts.type || null,
        macarraoMissing: parts.type ? "size" : "both",
        pendingItems: [],
      });
      if (parts.type && !parts.size) {
        await sendWhatsAppReply(from, "E o tamanho? 📏\n• P (pequeno)\n• G (grande)", sessionId);
      } else {
        await sendWhatsAppReply(from, "Qual tipo de macarrão você gostaria? 🍝\n• Na chapa\n• À bolonhesa", sessionId);
      }
      return true;
    }

    await sendWhatsAppReply(from, "Olá! 🍔 Envie seu pedido em uma única mensagem e eu anoto tudo!(ex: 2 X-Bacon e uma Coca Lata", sessionId);
    updateSession(phone, { step: "RECEBER_ITENS" });
    return true;
  },

  // ── RECEBER_ITENS ─────────────────────────────────────────────────────────
  async RECEBER_ITENS(ctx) {
    const { phone, from, rawMessage, sessionId, session } = ctx;
    const { products, additions } = await getMenuData();

    let parsed = null;

    if (!session.skipParsing) {
      const segments = splitOnEUm(rawMessage);
      let allItems = [];
      let allLeftovers = [];

      for (const seg of segments) {
        const segMsg = seg.trim();
        if (!segMsg) continue;
        const segNormalized = normalizeOrderText(segMsg);
        const parsedSeg = parseOrderByKeywords(segNormalized, products, additions);
        if (parsedSeg && parsedSeg.items.length > 0) {
          allItems = allItems.concat(parsedSeg.items);
          allLeftovers = allLeftovers.concat(parsedSeg.leftoverWords || []);
        }
      }

      if (allItems.length > 0) {
        // Use only keyword parser – no LLM fallback.
        // hadLeftover will show a warning in the confirmation if something wasn't recognized.
        parsed = {
          order: true,
          items: allItems,
          byKeyword: true,
          hadLeftover: allLeftovers.length > 0,
        };
      } else {
        parsed = null;
      }
    } else {
      parsed = { order: true, items: session.items || [] };
      updateSession(phone, { skipParsing: false });
    }

    if (!parsed || parsed.order === false || !parsed.items || parsed.items.length === 0) {
      const lowerMsg = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (/\b(macarrao|mac|espaguete|spaghetti|espagueti)\b/.test(lowerMsg)) {
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
      const casual = getCasualReply(rawMessage);
      if (casual === SEND_MENU) {
        const sent = await sendMenuImage(from, sessionId);
        if (!sent) await sendWhatsAppReply(from, "Desculpe, não consegui enviar o cardápio agora. Tente novamente em instantes! 🙏", sessionId);
      } else {
        const fallback = casual || "Desculpe, não consegui entender. Pode tentar '2 X-Bacon, 1 Coca'?";
        await sendWhatsAppReply(from, fallback, sessionId);
      }

      const lowerCheck = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (
        (lowerCheck.includes("?") || lowerCheck.includes("??")) &&
        (lowerCheck.includes("entrega") || lowerCheck.includes("delivery") || lowerCheck.includes("entregam") || lowerCheck.includes("fazem") || lowerCheck.includes("fazendo"))
      ) {
        updateSession(phone, { orderType: "Delivery" });
      }

      return true;
    }

    const lowerRaw = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const hasMacarraoMention = /\b(macarrao|mac|espaguete|spaghetti|espagueti)\b/.test(lowerRaw);
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

    parsed.items = parsed.items.map((item) => {
      if (item.price != null && item.price > 0) return item;
      const match = products.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
      return { ...item, price: match ? match.price : 0 };
    });

    // LLM enrichment disabled – keyword parser handles additions itself
    // if (!parsed.byKeyword) { ... }

    let orderItems = parsed.items.map((item) => ({
      name: item.name, price: item.price || 0, quantity: item.quantity || 1,
      observation: item.observation || "", additions: item.additions || [],
    }));

    const finalItems = [];
    for (const item of orderItems) {
      if (!item.observation) {
        finalItems.push(item);
        continue;
      }

      const rawLower = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      const semClauses = [];
      const semRe = /(\d+)\s*sem\s+(\w+)/gi;
      let m;
      while ((m = semRe.exec(rawLower)) !== null) {
        semClauses.push({ qty: parseInt(m[1], 10), ingredient: m[2] });
      }

      if (semClauses.length === 0) {
        finalItems.push(item);
        continue;
      }

      let remaining = item.quantity;

      for (const clause of semClauses) {
        if (clause.qty <= 0) continue;
        const effectiveQty = Math.min(clause.qty, remaining);
        if (effectiveQty <= 0) continue;
        remaining -= effectiveQty;
        const obsLabel = `Sem ${clause.ingredient.charAt(0).toUpperCase() + clause.ingredient.slice(1)}`;
        finalItems.push({ ...item, quantity: effectiveQty, observation: obsLabel, additions: [] });
      }

      if (remaining > 0) {
        finalItems.push({ ...item, quantity: remaining, observation: "" });
      }
    }

    const usedWords = new Set();
    for (const item of parsed.items) {
      const nameWords = item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(" ");
      nameWords.forEach(w => usedWords.add(w));
      if (item.additions) {
        item.additions.forEach(a => {
          const addWords = a.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(" ");
          addWords.forEach(w => usedWords.add(w));
        });
      }
    }
    finalItems.forEach(item => {
      if (item.observation) {
        item.observation.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ").forEach(w => usedWords.add(w));
      }
    });

    const unknownAddition = detectUnknownAddition(rawMessage, usedWords);
    if (unknownAddition) {
      const optionList = unknownAddition.options
        .map((opt, i) => `${i + 1} - ${opt.name}`)
        .join("\n");

      const aliasWord = unknownAddition.aliasWord;
      const msgWords = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/);
      const aliasWordIndex = msgWords.indexOf(aliasWord);
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < finalItems.length; i++) {
        const itemFirstWord = finalItems[i].name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase().split(" ")[0];
        let lastPos = -1;
        for (let j = 0; j < msgWords.length; j++) {
          if (msgWords[j] === itemFirstWord) lastPos = j;
        }
        if (lastPos >= 0 && aliasWordIndex - lastPos < minDist) {
          minDist = aliasWordIndex - lastPos;
          closestIdx = i;
        }
      }

      updateSession(phone, {
        step: "PERGUNTAR_ADICIONAL",
        pendingAdditionAlias: unknownAddition,
        pendingAdditionTargetIndex: closestIdx,
        items: finalItems,
      });
      await sendWhatsAppReply(
        from,
        `🍖 Qual ${unknownAddition.category} você gostaria?\n${optionList}`,
        sessionId
      );
      return true;
    }

    // ── Drink disambiguation ──────────────────
    for (let i = 0; i < finalItems.length; i++) {
      const item = finalItems[i];
      const itemNameNorm = item.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      let triggerWord = null;
      for (const gw of GENERIC_DRINK_WORDS) {
        if (itemNameNorm.includes(gw)) { triggerWord = gw; break; }
      }
      if (!triggerWord) continue;
      if (!needsDrinkDisambiguation(rawMessage, triggerWord)) continue;

      const options = getDrinkOptions(triggerWord, products);
      if (options.length <= 1) continue;

      const optionList = options
        .map((opt, idx) => `${idx + 1} - ${opt.name}`)
        .join("\n");

      updateSession(phone, {
        step: "PERGUNTAR_BEBIDA",
        pendingDrinkOptions: options,
        pendingDrinkTargetIndex: i,
        items: finalItems,
      });
      await sendWhatsAppReply(
        from,
        `🥤 Qual ${triggerWord.charAt(0).toUpperCase() + triggerWord.slice(1)} você prefere?\n${optionList}`,
        sessionId
      );
      return true;
    }

    const updates = { items: finalItems };
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
      const warning = parsed?.hadLeftover
        ? "\n\n⚠️ Notei algo na sua mensagem que não reconheci — confira se está tudo certo."
        : "";
      await sendWhatsAppReply(from, `📝 Resumo do pedido:\n\n${itens}\n\n🏷️ ${tipo}\n💳 ${sess.payment}\n💰 Total: R$ ${total.toFixed(2)}${warning}\n\nConfirma? (sim / não)`, sessionId);
      return true;
    }

    if (!hasType) {
      updateSession(phone, { step: "PERGUNTAR_TIPO" });
      await sendWhatsAppReply(from, "📋 Itens registados! Como deseja receber o pedido?\n1️⃣ Para levar\n2️⃣ Entrega\n3️⃣ No local", sessionId);
    } else if (needAddr && !hasAddr) {
      const addrInMsg = extractAddress(rawMessage);
      if (addrInMsg) {
        updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: addrInMsg });
        await sendWhatsAppReply(from, "💳 Qual a forma de pagamento? (Dinheiro, Cartão ou Pix)", sessionId);
      } else {
        updateSession(phone, { step: "PERGUNTAR_MORADA" });
        await sendWhatsAppReply(from, "🏠 Qual o endereço completo para entrega?\nExemplo: Rua das Flores, 123, apto 2", sessionId);
      }
    }
    else if (!hasPayment) {
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
    const addr = rawMessage.trim();

    if (isWeakAddress(addr)) {
      await sendWhatsAppReply(
        from,
        "Por favor, envie o endereço completo com rua e número.\nExemplo: Rua das Flores, 123, apto 2",
        sessionId
      );
      return true; // stay in PERGUNTAR_MORADA
    }

    updateSession(phone, { step: "PERGUNTAR_PAGAMENTO", address: addr });
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
    const sess = getSession(phone);
    const isDelivery = sess.orderType === "Delivery";

    if (isDelivery && pay === "Dinheiro") {
      updateSession(phone, { payment: pay, step: "PERGUNTAR_TROCO" });
      await sendWhatsAppReply(from, "💵 Vai precisar de troco? (sim / não)", sessionId);
      return true;
    }

    if (isDelivery) {
      updateSession(phone, { payment: pay, step: "AGUARDAR_TAXA" });
      const updatedSess = getSession(phone);
      const { itens } = buildOrderSummary(updatedSess);
      try {
        const newOrder = new Order({
          customerDetails: { name: ctx.contact?.name || "Cliente WhatsApp", phone, guests: 1 },
          orderType: "Delivery",
          deliveryAddress: updatedSess.address,
          whatsappChatId: from,
          table: null,
          isStanding: false,
          orderStatus: "Pending",
          bills: { total: updatedSess.items.reduce((s, i) => s + (i.price + (i.additions || []).reduce((a, b) => a + b.price, 0)) * (i.quantity || 1), 0), tax: 0, totalWithTax: updatedSess.items.reduce((s, i) => s + (i.price + (i.additions || []).reduce((a, b) => a + b.price, 0)) * (i.quantity || 1), 0) },
          items: updatedSess.items,
          paymentMethod: pay,
          paymentStatus: "PendingDeliveryFee",
        });
        await newOrder.save();
        // 🆕 Update customer record
        const orderTotal = newOrder.bills?.totalWithTax || 0;
        await updateCustomerRecord(phone, ctx.contact?.name || "Cliente WhatsApp", from, orderTotal);

        console.log(`🛵 Delivery order ${newOrder._id} saved – waiting for employee to set fee`);
        updateSession(phone, { step: "CONFIRMAR", pendingOrderId: String(newOrder._id) });
        await sendWhatsAppReply(
          from,
          `✅ Pedido recebido!\n\n${itens}\n\n🏠 Entrega em: ${updatedSess.address}\n💳 ${pay}\n\n⏳ Estamos a calcular a taxa de entrega. Em breve enviamos o total final para confirmar!`,
          sessionId
        );
      } catch (err) {
        console.error("Erro ao guardar pedido delivery:", err);
        await sendWhatsAppReply(from, "Houve um problema ao registar o pedido. Tente novamente.", sessionId);
      }
      return true;
    }

    updateSession(phone, { payment: pay, step: "CONFIRMAR" });
    const updatedSess = getSession(phone);
    const { total, tipo, itens } = buildOrderSummary(updatedSess);
    await sendWhatsAppReply(from, `📝 Resumo do pedido:\n\n${itens}\n\n🏷️ ${tipo}\n💳 ${pay}\n💰 Total: R$ ${total.toFixed(2)}\n\nConfirma? (sim / não)`, sessionId);
    return true;
  },

  // ── PERGUNTAR_TROCO ──────────────────────────────────────────────────────
  async PERGUNTAR_TROCO(ctx) {
    const { phone, from, rawMessage, sessionId } = ctx;
    const pos = ["sim", "s", "quero", "preciso", "sim sim", "yes", "vai"];
    const neg = ["nao", "não", "n", "nao precisa", "não precisa"];
    const msg = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    if (pos.some((p) => msg.includes(p))) {
      updateSession(phone, { changeNeeded: true, step: "PERGUNTAR_VALOR_TROCO" });
      await sendWhatsAppReply(from, "💵 Troco para quanto? (ex: 20)", sessionId);
      return true;
    } else if (neg.some((n) => msg.includes(n))) {
      updateSession(phone, { changeNeeded: false, changeFor: 0, step: "AGUARDAR_TAXA" });
      const sess = getSession(phone);
      const { itens } = buildOrderSummary(sess);
      try {
        const newOrder = new Order({
          customerDetails: { name: ctx.contact?.name || "Cliente WhatsApp", phone, guests: 1 },
          orderType: "Delivery",
          deliveryAddress: sess.address,
          whatsappChatId: from,
          table: null,
          isStanding: false,
          orderStatus: "Pending",
          bills: { total: sess.items.reduce((s, i) => s + (i.price + (i.additions || []).reduce((a, b) => a + b.price, 0)) * (i.quantity || 1), 0), tax: 0, totalWithTax: sess.items.reduce((s, i) => s + (i.price + (i.additions || []).reduce((a, b) => a + b.price, 0)) * (i.quantity || 1), 0) },
          items: sess.items,
          paymentMethod: "Dinheiro",
          paymentStatus: "PendingDeliveryFee",
          changeNeeded: false,
          changeFor: 0,
        });
        await newOrder.save();
        // 🆕 Update customer record
        const orderTotal = newOrder.bills?.totalWithTax || 0;
        await updateCustomerRecord(phone, ctx.contact?.name || "Cliente WhatsApp", from, orderTotal);

        updateSession(phone, { step: "CONFIRMAR", pendingOrderId: String(newOrder._id) });
        await sendWhatsAppReply(from, `✅ Pedido recebido sem troco!\n\n${itens}\n\n🏠 Entrega em: ${sess.address}\n💳 Dinheiro\n\n⏳ Taxa de entrega será confirmada em breve.`, sessionId);
      } catch (err) {
        console.error("Erro ao guardar pedido delivery:", err);
        await sendWhatsAppReply(from, "Houve um problema ao registar o pedido. Tente novamente.", sessionId);
      }
      return true;
    } else {
      await sendWhatsAppReply(from, "Por favor, responda *sim* ou *não*.", sessionId);
      return true;
    }
  },

  // ── PERGUNTAR_VALOR_TROCO ───────────────────────────────────────────────
  async PERGUNTAR_VALOR_TROCO(ctx) {
    const { phone, from, rawMessage, sessionId } = ctx;
    const numMatch = rawMessage.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : null;

    if (num !== null && num > 0) {
      updateSession(phone, { changeFor: num, step: "AGUARDAR_TAXA" });
      const sess = getSession(phone);
      const { itens } = buildOrderSummary(sess);
      try {
        const newOrder = new Order({
          customerDetails: { name: ctx.contact?.name || "Cliente WhatsApp", phone, guests: 1 },
          orderType: "Delivery",
          deliveryAddress: sess.address,
          whatsappChatId: from,
          table: null,
          isStanding: false,
          orderStatus: "Pending",
          bills: { total: sess.items.reduce((s, i) => s + (i.price + (i.additions || []).reduce((a, b) => a + b.price, 0)) * (i.quantity || 1), 0), tax: 0, totalWithTax: sess.items.reduce((s, i) => s + (i.price + (i.additions || []).reduce((a, b) => a + b.price, 0)) * (i.quantity || 1), 0) },
          items: sess.items,
          paymentMethod: "Dinheiro",
          paymentStatus: "PendingDeliveryFee",
          changeNeeded: true,
          changeFor: num,
        });
        await newOrder.save();
        // 🆕 Update customer record
        const orderTotal = newOrder.bills?.totalWithTax || 0;
        await updateCustomerRecord(phone, ctx.contact?.name || "Cliente WhatsApp", from, orderTotal);

        updateSession(phone, { step: "CONFIRMAR", pendingOrderId: String(newOrder._id) });
        await sendWhatsAppReply(from, `✅ Pedido recebido! Troco para R$ ${num.toFixed(2)}\n\n${itens}\n\n🏠 Entrega em: ${sess.address}\n💳 Dinheiro\n\n⏳ Taxa de entrega será confirmada em breve.`, sessionId);
      } catch (err) {
        console.error("Erro ao guardar pedido delivery:", err);
        await sendWhatsAppReply(from, "Houve um problema ao registar o pedido. Tente novamente.", sessionId);
      }
      return true;
    } else {
      await sendWhatsAppReply(from, "Não entendi o valor. Pode enviar apenas o número (ex: 20).", sessionId);
      return true;
    }
  },

  // ── PERGUNTAR_ADICIONAL ──────────────────────────────────────────────────
  async PERGUNTAR_ADICIONAL(ctx) {
    const { phone, from, rawMessage, sessionId, session } = ctx;
    const aliasInfo = session.pendingAdditionAlias;
    const targetIndex = session.pendingAdditionTargetIndex;

    if (!aliasInfo) {
      updateSession(phone, { step: "RECEBER_ITENS" });
      return false;
    }

    if (aliasInfo.options.length === 1) {
      const chosenOption = aliasInfo.options[0];
      const items = session.items || [];
      if (targetIndex === undefined || !items[targetIndex]) {
        await sendWhatsAppReply(from, "Erro interno – não foi possível adicionar o item.", sessionId);
        clearSession(phone);
        return true;
      }
      const targetItem = items[targetIndex];
      if (!targetItem.additions) targetItem.additions = [];
      targetItem.additions.push({ name: chosenOption.name, price: chosenOption.price });

      updateSession(phone, {
        step: "RECEBER_ITENS",
        items: items,
        pendingAdditionAlias: null,
        pendingAdditionTargetIndex: null,
        skipParsing: true,
      });
      await sendWhatsAppReply(from, `✅ Adicionado: ${chosenOption.name}`, sessionId);
      return false;
    }

    const choice = rawMessage.trim();
    let chosenOption = null;
    if (/^\d+$/.test(choice)) {
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < aliasInfo.options.length) {
        chosenOption = aliasInfo.options[idx];
      }
    } else {
      const normalizedChoice = choice.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      chosenOption = aliasInfo.options.find(opt =>
        opt.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedChoice)
      );
    }

    if (!chosenOption) {
      const optionList = aliasInfo.options
        .map((opt, i) => `${i + 1} - ${opt.name}`)
        .join("\n");
      await sendWhatsAppReply(from, `Desculpe, não encontrei essa opção. Escolha uma das seguintes:\n${optionList}`, sessionId);
      return true;
    }

    const items = session.items || [];
    if (targetIndex === undefined || !items[targetIndex]) {
      await sendWhatsAppReply(from, "Erro interno – não foi possível adicionar o item.", sessionId);
      clearSession(phone);
      return true;
    }
    const targetItem = items[targetIndex];
    if (!targetItem.additions) targetItem.additions = [];
    targetItem.additions.push({ name: chosenOption.name, price: chosenOption.price });

    updateSession(phone, {
      step: "RECEBER_ITENS",
      items: items,
      pendingAdditionAlias: null,
      pendingAdditionTargetIndex: null,
      skipParsing: true,
    });
    await sendWhatsAppReply(from, `✅ Adicionado: ${chosenOption.name}`, sessionId);
    return false;
  },

  // ── PERGUNTAR_BEBIDA ──────────────────────────────────────────────────────
  async PERGUNTAR_BEBIDA(ctx) {
    const { phone, from, rawMessage, sessionId, session } = ctx;
    const options = session.pendingDrinkOptions;
    const targetIndex = session.pendingDrinkTargetIndex;

    if (!options || options.length === 0 || targetIndex === undefined) {
      updateSession(phone, { step: "RECEBER_ITENS" });
      return false;
    }

    const choice = rawMessage.trim();
    let chosenOption = null;

    if (/^\d+$/.test(choice)) {
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < options.length) chosenOption = options[idx];
    } else {
      const normalizedChoice = choice
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      chosenOption = options.find(opt =>
        opt.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
          .includes(normalizedChoice)
      );
    }

    if (!chosenOption) {
      const optionList = options.map((opt, i) => `${i + 1} - ${opt.name}`).join("\n");
      await sendWhatsAppReply(
        from,
        `Desculpe, não encontrei essa opção. Escolha uma das seguintes:\n${optionList}`,
        sessionId
      );
      return true;
    }

    const items = session.items || [];
    if (targetIndex >= items.length) {
      await sendWhatsAppReply(from, "Erro interno – não foi possível alterar a bebida.", sessionId);
      clearSession(phone);
      return true;
    }

    const oldItem = items[targetIndex];
    items[targetIndex] = {
      name: chosenOption.name,
      price: chosenOption.price,
      quantity: oldItem.quantity || 1,
      observation: oldItem.observation || "",
      additions: oldItem.additions || [],
    };

    updateSession(phone, {
      step: "RECEBER_ITENS",
      items,
      pendingDrinkOptions: null,
      pendingDrinkTargetIndex: null,
      skipParsing: true,
    });
    await sendWhatsAppReply(from, `✅ Bebida alterada para: ${chosenOption.name}`, sessionId);
    return false;
  },

  // ── AGUARDAR_TAXA ─────────────────────────────────────────────────────────
  async AGUARDAR_TAXA(ctx) {
    const { from, sessionId } = ctx;
    await sendWhatsAppReply(from, "⏳ O seu pedido já foi recebido! Estamos a calcular a taxa de entrega e enviamos o total em breve.", sessionId);
    return true;
  },

  // ── ENCERRAR ─────────────────────────────────────────────────────────────
  async ENCERRAR(ctx) {
    const { phone, from, sessionId } = ctx;
    await sendWhatsAppReply(from, "Certo! Um atendente vai conversar com você, aguarde um instante. 👩‍🍳", sessionId);
    muteSession(phone);
    return true;
  },

  // ── CONFIRMAR ────────────────────────────────────────────────────────────
  async CONFIRMAR(ctx) {
    const { phone, from, rawMessage, sessionId, contact } = ctx;
    const cl = classifyStep("CONFIRMAR", rawMessage);

    if (cl?.confirmado === true) {
      const sess = getSession(phone);

      // Delivery path: order already exists in DB
      if (sess.pendingOrderId) {
        try {
          const existingOrder = await Order.findById(sess.pendingOrderId);
          if (existingOrder) {
            existingOrder.orderStatus = "Pending";
            await existingOrder.save();

            let confirmMsg = `✅ Pedido #${String(existingOrder._id).slice(-6)} confirmado! Já estamos preparando. Obrigado pela preferência! 🍔`;
            confirmMsg += etaMessage("Delivery");

            if (existingOrder.paymentMethod === "Pix") {
              confirmMsg += "\n\n ❖Chave Pix: 000.00.000-00\n👤 Person";
            }

            await sendWhatsAppReply(from, confirmMsg, sessionId);
          } else {
            await sendWhatsAppReply(from, "Não encontrei o pedido. Por favor, tente novamente.", sessionId);
          }
        } catch (err) {
          console.error("Erro ao confirmar pedido delivery:", err);
          await sendWhatsAppReply(from, "Houve um problema ao confirmar. Tente novamente.", sessionId);
        }
        muteSession(phone);
        return true;
      }

      // Normal path (Takeaway / Dine-in)
      if (sess.orderType === "Delivery" && !sess.pendingOrderId) {
        console.error(`⚠️  CONFIRMAR reached for Delivery session without pendingOrderId – phone: ${phone}`);
        await sendWhatsAppReply(from, "Houve um problema ao localizar o seu pedido. Por favor, tente novamente.", sessionId);
        clearSession(phone);
        return true;
      }

      try {
        const { total } = buildOrderSummary(sess);
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
        // 🆕 Update customer record
        const orderTotal = newOrder.bills?.totalWithTax || 0;
        await updateCustomerRecord(phone, contact?.name || "Cliente WhatsApp", from, orderTotal);

        let confirmMsg = `✅ Pedido #${String(newOrder._id).slice(-6)} confirmado! Já estamos preparando. Obrigado pela preferência! 🍔`;
        confirmMsg += etaMessage(newOrder.orderType);

        if (newOrder.paymentMethod === "Pix") {
          confirmMsg += "\n\n💳 Chave Pix: 000.000.000\n👤 Person";
        }

        await sendWhatsAppReply(from, confirmMsg, sessionId);
      } catch (err) {
        console.error("Erro ao criar pedido:", err);
        await sendWhatsAppReply(from, "Houve um problema ao criar o seu pedido. Por favor, tente novamente.", sessionId);
      }
      muteSession(phone);

    } else if (cl?.confirmado === false) {
      await sendWhatsAppReply(from, "Certo! Um atendente vai conversar com você, aguarde um instante. 👩‍🍳", sessionId);
      muteSession(phone);
      return true;
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

    // ── TRACKING MODE: silently log order, no replies, no POS interaction ──
    if (process.env.WHATSAPP_TRACKING_MODE === "true") {
      const { products, additions } = await getMenuData();
      const normalizedMsg = normalizeOrderText(rawMessage);

      let parsedItems = [];
      try {
        const keywordResult = parseOrderByKeywords(normalizedMsg, products, additions);
        if (keywordResult && keywordResult.items.length > 0) {
          parsedItems = keywordResult.items;
        }
        // LLM fallback disabled – only keyword parsing
      } catch (e) {
        console.error("Tracking parse error:", e.message);
      }

      if (parsedItems.length > 0) {
        const orderType = extractOrderType(rawMessage) || "Takeaway";
        const payment = extractPayment(rawMessage) || "Não informado";
        const address = orderType === "Delivery" ? extractAddress(rawMessage) || "Não informado" : undefined;

        const total = parsedItems.reduce((sum, item) => {
          const addPrice = (item.additions || []).reduce((a, add) => a + (add.price || 0), 0);
          return sum + (item.price + addPrice) * (item.quantity || 1);
        }, 0);

        const TrackedOrder = require("../models/TrackedOrder");
        await TrackedOrder.create({
          phone,
          customerName: contact?.name || "Cliente WhatsApp",
          items: parsedItems,
          orderType,
          deliveryAddress: address,
          paymentMethod: payment,
          total,
          originalMessage: rawMessage,
        });

        try {
          await updateCustomerRecord(phone, contact?.name || "Cliente WhatsApp", from, total);
        } catch (e) {
          console.error("Customer update error:", e.message);
        }

        console.log(`✅ Pedido rastreado: ${phone} – ${parsedItems.length} itens, R$${total.toFixed(2)}`);

        // ── Instant cross‑sell / addition upsell ──────────────────────────
        const hasBurger = parsedItems.some(i =>
          i.name.toLowerCase().includes("x-") ||
          i.name === "Hamburguer" ||
          i.name === "Hambúrguer Especial"
        );
        const hasDrink = parsedItems.some(i =>
          /coca|guarana|fanta|sprite|suco|agua|mate|refrigerante/i.test(i.name)
        );
        const hasSide = parsedItems.some(i =>
          /batata|onion|nuggets|macarrão|macarrao/i.test(i.name)
        );

        // Cross‑sell: only burger(s), no drink, no side → suggest drink
        if (hasBurger && !hasDrink && !hasSide) {
          const suggestion = crossSellUpsellConfig.crossSellCategories["Sanduíches"][0]; // "Coca Cola Lata"
          const msg = `🍔 Que tal completar seu combo? Adicione uma ${suggestion} por apenas R$6 e ganhe 5% de desconto com o cupom CROSS5.`;
          try {
            await sendWhatsAppReply(from, msg, sessionId);
            console.log(`Cross‑sell instant sent to ${phone}`);
          } catch (e) {
            console.error("Cross‑sell send error:", e.message);
          }
        }

        // Addition upsell: burger without a popular addition
        if (hasBurger) {
          const orderedAdditions = new Set();
          parsedItems.forEach(i => (i.additions || []).forEach(a => orderedAdditions.add(a.name)));
          for (const add of crossSellUpsellConfig.popularAdditions) {
            if (!orderedAdditions.has(add.name)) {
              try {
                await sendWhatsAppReply(from, add.msg, sessionId);
                console.log(`Addition upsell instant ("${add.name}") sent to ${phone}`);
                break; // only one suggestion per order
              } catch (e) {
                console.error("Addition upsell error:", e.message);
              }
            }
          }
        }
        // ── Fim das reações instantâneas ──────────────────────────────────

      } else {
        console.log(`ℹ️ Nenhum item detectado na mensagem de ${phone}`);
      }

      return res.json({ status: "tracked" });
    }
    // ── END OF TRACKING MODE ────────────────────────────────────────────────

    await sendTyping(from, sessionId);

    const lowerMsg = rawMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // ---- Cardápio ----
    if (lowerMsg.includes("cardapio") || lowerMsg.includes("menu")) {
      const sent = await sendMenuImage(from, sessionId);
      if (!sent) await sendWhatsAppReply(from, "Desculpe, não consegui enviar a imagem do cardápio agora. Tente novamente em instantes! 🙏", sessionId);
      return res.json({ status: "ok" });
    }

    // ---- Cancel command ----
    if (rawMessage.toLowerCase() === "cancelar") {
      clearSession(phone);
      await sendWhatsAppReply(from, "Pedido cancelado. Se precisar de algo mais, é só pedir! 🙂", sessionId);
      return res.json({ status: "cancelled" });
    }

    // ---- Opt-out from promotions ----
    if (lowerMsg === "sair" || lowerMsg === "pare" || lowerMsg === "nao quero promocao") {
      try {
        const Customer = require("../models/Customer");
        await Customer.findOneAndUpdate({ phone }, { optedOut: true }, { upsert: true });
        await sendWhatsAppReply(from, "Você não receberá mais nossas promoções. 😢", sessionId);
      } catch (err) {
        console.error("Opt-out error:", err.message);
      }
      return res.json({ status: "opted_out" });
    }

    // ---- Get current session ----
    let session = getSession(phone);

    // ---- Bot turned off ----
    if (!botStatusRoute.isBotActive()) {
      return res.json({ status: "bot_offline" });
    }

    // ---- Muted session check ----
    if (session.muted) {
      if (/\b(novo pedido|quero pedir|fazer pedido)\b/i.test(lowerMsg)) {
        unmuteSession(phone);
        session = getSession(phone);
      } else {
        return res.json({ status: "muted" });
      }
    }

    // ---- Admin-only metrics ----
    if (lowerMsg === "metricas" || lowerMsg === "métricas") {
      const adminPhone = process.env.ADMIN_PHONE;
      if (adminPhone && from === adminPhone) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

        const Order = require("../models/orderModel");
        const orderCount = await Order.countDocuments({ orderDate: { $gte: start, $lt: end } });
        const revenueData = await Order.aggregate([
          { $match: { orderDate: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
        ]);
        const revenue = revenueData[0]?.total || 0;
        const cashCount = await Order.countDocuments({ orderDate: { $gte: start, $lt: end }, paymentMethod: "Dinheiro", paymentStatus: "Paid" });
        const cardCount = await Order.countDocuments({ orderDate: { $gte: start, $lt: end }, paymentMethod: "Cartão", paymentStatus: "Paid" });
        const pixCount = await Order.countDocuments({ orderDate: { $gte: start, $lt: end }, paymentMethod: "Pix", paymentStatus: "Paid" });

        const msg = [
          "📊 *Hoje até agora*",
          "",
          `🧾 Pedidos: ${orderCount}`,
          `💰 Receita: R$ ${revenue.toFixed(2)}`,
          "",
          `💵 Dinheiro: ${cashCount}`,
          `💳 Cartão: ${cardCount}`,
          `🟣 Pix: ${pixCount}`,
        ].join("\n");

        await sendWhatsAppMessage(from, msg, sessionId);
      }
      return res.json({ status: "metrics_sent" });
    }

    // ---- State machine ----
    const ctx = { phone, from, rawMessage, sessionId, session, contact };
    const visited = new Set();

    for (; ;) {
      const currentStep = getSession(phone).step;
      if (visited.has(currentStep)) break;
      visited.add(currentStep);

      const handler = stepHandlers[currentStep];
      if (!handler) break;

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