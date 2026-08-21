const path = require("path");
const fs = require("fs");
const axios = require("axios");

// Try loading .env, fallback to env.defaults if .env doesn't exist
const envPath = path.join(__dirname, ".env");
const envDefaultsPath = path.join(__dirname, "env.defaults");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config({ path: envDefaultsPath });
}

const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const cron = require("node-cron");
const Order = require("./models/orderModel");
const DailySummary = require("./models/DailySummary");
const app = express();

const PORT = config.port;
connectDB();

// ---------- Helper: brazil date string ----------
const getLocalDateStr = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Middlewares
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173", "http://10.33.14.90:5173"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
  if (config.nodeEnv !== "production") {
    console.log(`📡 ${req.method} ${req.url}`);
  }
  next();
});

// API Routes
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/product", require("./routes/productRoute"));
app.use("/api/category", require("./routes/categoryRoute"));
app.use("/api/summary", require("./routes/summaryRoute"));
app.use("/api/addition", require("./routes/additionRoute"));
app.use("/api/whatsapp", require("./routes/whatsappRoute"));
app.use("/api/order", require("./routes/deliveryFeeRoute"));
app.use("/api/bot-status", require("./routes/botStatusRoute"));
app.use("/api/customer", require("./routes/customerRoute"));
app.use("/api/advanced-marketing", require("./routes/advancedMarketingRoute"));

// Serve static files from pos-backend/public (menu image, etc.)
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static("public"));

// ---------- Serve the frontend ----------
const frontendPath = process.env.STATIC_FRONTEND_PATH || path.join(__dirname, "../pos-frontend/dist");
app.use(express.static(frontendPath));

// Any non‑API route → index.html (React Router)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Global Error Handler
app.use(globalErrorHandler);

// ---------- Auto‑start OpenWA session on backend boot ----------
async function ensureOpenWASessionActive() {
  const OPENWA_BASE = process.env.OPENWA_URL || "http://localhost:2785";
  const API_KEY = process.env.OPENWA_API_KEY || "dev-admin-key";
  const SESSION_ID = process.env.OPENWA_SESSION_ID;

  if (!SESSION_ID) {
    console.log("⚠️  OPENWA_SESSION_ID not set – skipping auto‑start");
    return;
  }

  try {
    const { data: session } = await axios.get(
      `${OPENWA_BASE}/api/sessions/${SESSION_ID}`,
      { headers: { "X-API-Key": API_KEY } }
    );

    if (session.status === "disconnected" || session.status === "stopped") {
      console.log(`⚡ Session ${SESSION_ID} is "${session.status}" – starting...`);
      await axios.post(
        `${OPENWA_BASE}/api/sessions/${SESSION_ID}/start`,
        {},
        { headers: { "X-API-Key": API_KEY } }
      );
      console.log(`✅ Session ${SESSION_ID} started successfully`);
    } else {
      console.log(`✅ Session ${SESSION_ID} is ${session.status} – no need to start`);
    }

    const { data: webhooks } = await axios.get(
      `${OPENWA_BASE}/api/sessions/${SESSION_ID}/webhooks`,
      { headers: { "X-API-Key": API_KEY } }
    );

    const expectedUrl = `http://host.docker.internal:3000/api/whatsapp/webhook`;
    const alreadyRegistered = webhooks.some(w => w.url === expectedUrl);

    if (!alreadyRegistered) {
      console.log(`⚡ Webhook not found – registering...`);
      await axios.post(
        `${OPENWA_BASE}/api/sessions/${SESSION_ID}/webhooks`,
        { url: expectedUrl, events: ["message.received"] },
        { headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" } }
      );
      console.log(`✅ Webhook registered`);
    } else {
      console.log(`✅ Webhook already registered`);
    }
  } catch (err) {
    console.error("❌ Failed to auto‑start OpenWA session:", err.message);
  }
}

// ---------- Cron job: save daily summary at midnight (Brasília time) ----------
cron.schedule("0 0 * * *", async () => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = getLocalDateStr(yesterday);

    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const orderCount = await Order.countDocuments({ orderDate: { $gte: start, $lt: end } });
    const revenueData = await Order.aggregate([
      { $match: { orderDate: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
    ]);
    const revenue = revenueData[0]?.total || 0;
    const completedCount = await Order.countDocuments({
      orderStatus: "Completed",
      updatedAt: { $gte: start, $lt: end },
    });

    const cashCount = await Order.countDocuments({
      orderDate: { $gte: start, $lt: end },
      paymentStatus: "Paid",
      paymentMethod: "Dinheiro"
    });
    const cardCount = await Order.countDocuments({
      orderDate: { $gte: start, $lt: end },
      paymentStatus: "Paid",
      paymentMethod: "Cartão"
    });
    const pixCount = await Order.countDocuments({
      orderDate: { $gte: start, $lt: end },
      paymentStatus: "Paid",
      paymentMethod: "Pix"
    });

    const avgTimeData = await Order.aggregate([
      { $match: { readyAt: { $gte: start, $lt: end, $ne: null } } },
      { $project: { timeDiff: { $subtract: ["$readyAt", "$orderDate"] } } },
      { $group: { _id: null, average: { $avg: "$timeDiff" } } },
    ]);
    const averageTimeMinutes = avgTimeData.length
      ? Math.round(avgTimeData[0].average / 60000)
      : 0;

    await DailySummary.findOneAndUpdate(
      { date: dateStr },
      {
        orderCount,
        revenue,
        completedCount,
        averageTimeMinutes,
        cashCount,
        cardCount,
        pixCount,
      },
      { upsert: true }
    );

    console.log(`📊 Resumo automático guardado para ${dateStr}`);

    // 🆕 Send summary to admin WhatsApp
    const adminPhone = process.env.ADMIN_PHONE;
    if (adminPhone) {
      const sendWhatsAppMessage = require("./utils/sendWhatsAppMessage");
      const msg = [
        `📊 *Resumo do dia ${dateStr}*`,
        "",
        `🧾 Pedidos: ${orderCount}`,
        `✅ Finalizados: ${completedCount}`,
        `💰 Receita: R$ ${revenue.toFixed(2)}`,
        "",
        `💵 Dinheiro: ${cashCount}`,
        `💳 Cartão: ${cardCount}`,
        `🟣 Pix: ${pixCount}`,
        `⏱️ Tempo médio: ${averageTimeMinutes} min`,
      ].join("\n");

      await sendWhatsAppMessage(adminPhone, msg).catch(err =>
        console.error("Erro ao enviar resumo diário:", err.message)
      );
    }

  } catch (error) {
    console.error("Erro no resumo diário automático:", error);
  }
}, {
  timezone: "America/Sao_Paulo"
});

// ---------- Start the server ----------
app.listen(PORT, () => {
  console.log(`☑️  POS Server is listening on port ${PORT}`);
  ensureOpenWASessionActive();
});
