# Restaurant POS System with WhatsApp Ordering Bot

A full-stack restaurant point-of-sale system built with **Node.js**, **Express**, **MongoDB**, **React**, **Electron**, and **OpenWA**.

It includes an **automated WhatsApp assistant** that takes orders, sends the menu as an image, and guides customers through a complete ordering flow — all without human intervention.

---

# Features

* 🧾 **POS Interface** – React-based management of orders, tables, products, payments, and daily summaries.
* 🍔 **WhatsApp Ordering Bot** – Customers send natural messages like *“2 X-Bacon, 1 Coca”* and the bot processes them automatically.
* 🖼️ **Menu Image Delivery** – Sends a JPEG menu upon request.
* 🤖 **Hybrid Order Parsing** – Keyword matching first, then a local LLM (Ollama) as a fallback.
* 🗺️ **Smart Address Extraction** – Understands Brazilian street names and asks for clarification when the address is weak.
* 📊 **Daily Summaries** – Cron job saves total orders, revenue, and payment breakdowns every midnight (`America/Sao_Paulo` timezone).
* 🖥️ **Electron Desktop App** – Optional wrapper for the POS frontend for a native experience.

---

# Tech Stack

| Component           | Technology                           |
| ------------------- | ------------------------------------ |
| Backend             | Node.js, Express, MongoDB (Mongoose) |
| Frontend            | React (Vite), Redux, Tailwind CSS    |
| Desktop App         | Electron                             |
| WhatsApp Gateway    | OpenWA (Docker container)            |
| AI / LLM (optional) | Ollama (`phi3:mini`) running locally |
| Cron Jobs           | node-cron                            |

---

# Project Structure

```text
Restaurant_POS_System/
├── pos-backend/       # Express API, WhatsApp webhook, models, utils
├── pos-frontend/      # React POS dashboard
├── electron-app/      # Electron wrapper for the frontend
├── OpenWA/            # OpenWA Docker configuration & data
└── .gitignore
```

---

# Prerequisites

Before starting, make sure you have installed:

* **Node.js** (v18 or newer)
* **MongoDB** (local instance or cloud connection string)
* **Docker** (required for OpenWA if not running natively)
* **OpenWA**
* **Ollama** *(optional, only for LLM fallback)*

Helpful links:

* OpenWA: https://openwa.dev/docs/getting-started
* Ollama: https://ollama.com

---

# Installation

## 1. Clone the Repository

```bash
git clone https://github.com/joaolopezs/ProjectJoaoterio2.0.git
cd ProjectJoaoterio2.0
```

---

## 2. Backend Setup

```bash
cd pos-backend
npm install
```

Create a `.env` file (or copy from `env.defaults`):

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/pos
OPENWA_API_KEY=dev-admin-key
OLLAMA_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=phi3:mini
```

Start the backend:

```bash
npm start
```

---

## 3. Frontend Setup

```bash
cd ../pos-frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

---

## 4. OpenWA (WhatsApp Gateway)

From the `OpenWA` folder:

```bash
cd ../OpenWA
docker compose up -d
```

OpenWA API will run at:

```text
http://localhost:2785
```

### Initial Setup

1. Scan the QR code to connect your WhatsApp account.
2. Session data will persist inside:

```text
OpenWA/data
```

3. Register the webhook:

```text
http://host.docker.internal:3000/api/whatsapp/webhook
```

For event type:

```text
message.received
```

---

## 5. Ollama (Optional)

Only needed if you want AI fallback parsing.

Install the model:

```bash
ollama pull phi3:mini
```

The backend automatically uses Ollama if keyword extraction fails.

---

# WhatsApp Bot Flow

1. Customer sends any message → receives a greeting.
2. Customer sends order (example: `"2 X-Bacon, 1 Coca"`).
3. Bot extracts items and asks:

   * Delivery or pickup
4. Bot requests:

   * Address (if delivery)
   * Payment method
5. Bot shows order summary.
6. Customer confirms with `"sim"`.
7. Order is saved to MongoDB and appears in the POS dashboard.

### Additional Features

* Sending `"cardápio"` or `"menu"` automatically sends the restaurant menu image.
* If customer replies `"não"`, they can modify the order without restarting the flow.

---

# Customization

## Menu Items & Additions

Manage directly through:

* POS dashboard
* MongoDB collections

---

## LLM Prompt

Edit:

```text
pos-backend/utils/llmParser.js
```

---

## Casual Replies

Edit:

```text
getCasualReply()
```

Inside:

```text
pos-backend/routes/whatsappRoute.js
```

---

## Menu Image

Replace:

```text
pos-backend/public/images/cardapio.jpeg
```

And update the URL inside:

```text
sendMenuImage()
```

---

# Environment Variables

| Variable       | Description               | Default                         |
| -------------- | ------------------------- | ------------------------------- |
| PORT           | Backend server port       | 3000                            |
| MONGO_URI      | MongoDB connection string | Required                        |
| OPENWA_API_KEY | API key for OpenWA        | dev-admin-key                   |
| OLLAMA_URL     | Ollama endpoint           | http://localhost:11434/api/chat |
| OLLAMA_MODEL   | Fallback model            | phi3:mini                       |

---

# Deployment Notes

* Build the Electron app:

```bash
cd electron-app
npm run dist
```

* For production:

  * Replace `host.docker.internal` with the real backend IP/domain.
  * Use a strong `OPENWA_API_KEY`.

* Cron jobs currently use:

```text
America/Sao_Paulo
```

Change this if your restaurant operates in another timezone.

---

# License

This project is intended for internal restaurant use.

Modify and distribute as needed.

---

# Author

Built for João Pedro’s Restaurant 🍔
