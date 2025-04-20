const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Root route to confirm server is live
app.get('/', (req, res) => {
  res.send('✅ Heroku server is running and ready!');
});

// Payment route (mocked for now)
app.post('/payment', async (req, res) => {
  try {
    const { amount, customerProfileId, customerPaymentProfileId, orderId } = req.body;

    // MOCK response for now
    return res.json({
      success: true,
      message: `Processed payment of $${amount} for customer ${customerProfileId}`,
      orderId,
    });
  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Heroku server is running and ready on port ${PORT}`);
});
