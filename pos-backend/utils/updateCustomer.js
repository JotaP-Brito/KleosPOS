const Customer = require("../models/Customer");

async function updateCustomerRecord(phone, name, chatId, total) {
  if (!phone) return;
  try {
    await Customer.findOneAndUpdate(
      { phone },
      {
        $set: {
          name: name || undefined,
          whatsappChatId: chatId,
          lastOrderDate: new Date(),
        },
        $inc: {
          orderCount: 1,
          totalSpent: total || 0,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Error updating customer:", err.message);
  }
}

module.exports = { updateCustomerRecord };