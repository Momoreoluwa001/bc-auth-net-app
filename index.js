const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { APIContracts, APIControllers } = require("authorizenet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Test route to make sure server works
app.get("/", (req, res) => {
  res.send("✅ Heroku server is running and ready!");
});

// Test route for saving payment method (mock)
app.post("/api/save-payment", async (req, res) => {
  // For now we just log the incoming request
  console.log("Payment data received:", req.body);
  res.send({ message: "Payment route hit!" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
