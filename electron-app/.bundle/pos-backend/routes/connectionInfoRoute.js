const express = require("express");
const os = require("os");
const config = require("../config/config");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();
const isPrivateAddress = (address) => /^10\./.test(address) || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address);

const getLanAddresses = () => Object.entries(os.networkInterfaces()).flatMap(([adapter, entries]) => (entries || [])
  .filter((entry) => (entry.family === "IPv4" || entry.family === 4) && !entry.internal && !entry.address.startsWith("169.254."))
  .map((entry) => ({ adapter, address: entry.address, priority: (isPrivateAddress(entry.address) ? 20 : 0) + (/wi-?fi|wireless|ethernet/i.test(adapter) ? 10 : 0) - (/virtual|vmware|vethernet|hyper-v|docker|wsl|tailscale/i.test(adapter) ? 20 : 0) })))
  .sort((left, right) => right.priority - left.priority)
  .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.address === entry.address) === index)
  .map(({ adapter, address }) => ({ adapter, address }));

router.get("/", isVerifiedUser, admin, (req, res) => {
  const addresses = getLanAddresses();
  const preferredAddress = addresses[0]?.address || "127.0.0.1";
  const serverAddress = `${preferredAddress}:${config.port}`;
  const kitchenSecret = process.env.KITCHEN_SECRET || "";
  const waiterKey = process.env.WAITER_APP_KEY || "";
  res.set("Cache-Control", "no-store");
  res.json({ success: true, data: {
    hostname: os.hostname(), port: config.port, preferredAddress, serverAddress, addresses,
    kds: { serverAddress, url: `http://${serverAddress}/kitchen`, secret: kitchenSecret, configured: Boolean(kitchenSecret) },
    waiter: { serverAddress, key: waiterKey, configured: Boolean(waiterKey) },
    whatsapp: { configured: Boolean(process.env.OPENWA_SESSION_ID), sessionId: process.env.OPENWA_SESSION_ID || "" },
  } });
});

module.exports = router;
