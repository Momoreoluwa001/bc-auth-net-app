const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Default route
app.get("/", (req, res) => {
  res.send("✅ Heroku server is running and ready!");
});

// NEW: Handle payment POST
app.post("/", (req, res) => {
  const { email, cardNumber, expirationDate, cvv } = req.body;

  // Check for required fields
  if (!email || !cardNumber || !expirationDate || !cvv) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Just a dummy response for now
  return res.json({
    message: "Received payment info!",
    data: {
      email,
      cardNumber,
      expirationDate,
      cvv
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Heroku server is running and ready on port ${PORT}`);
});
