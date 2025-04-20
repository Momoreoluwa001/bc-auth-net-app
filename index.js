// index.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('✅ Heroku app is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


app.post("/payment", async (req, res) => {
  const { amount, customerProfileId, customerPaymentProfileId, orderId } = req.body;

  if (!amount || !customerProfileId || !customerPaymentProfileId || !orderId) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  res.json({
    success: true,
    message: "Payment route is working! 🚀",
    data: {
      amount,
      customerProfileId,
      customerPaymentProfileId,
      orderId
    }
  });
});
