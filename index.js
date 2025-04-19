app.use(express.json());

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Default route
app.get("/", (req, res) => {
  res.send("✅ Heroku server is running and ready!");
});

// Route to test raw payment info (optional)
app.post("/", (req, res) => {
  const { email, cardNumber, expirationDate, cvv } = req.body;

  if (!email || !cardNumber || !expirationDate || !cvv) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  return res.json({
    message: "Received payment info!",
    data: {
      email,
      cardNumber,
      expirationDate,
      cvv,
    },
  });
});

// Actual /payment endpoint with debug logging
app.post("/payment", async (req, res) => {
  try {
    console.log("🔥 Incoming request body:", req.body); // Log whole body

    const {
      amount,
      customerProfileId,
      customerPaymentProfileId,
      orderId,
    } = req.body;

    // Log individual values
    console.log("amount:", amount);
    console.log("customerProfileId:", customerProfileId);
    console.log("customerPaymentProfileId:", customerPaymentProfileId);
    console.log("orderId:", orderId);

    if (!amount || !customerProfileId || !customerPaymentProfileId || !orderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { APIContracts, APIControllers } = require("authorizenet");

    const merchantAuthenticationType = new APIContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(process.env.AUTHORIZE_API_LOGIN_ID);
    merchantAuthenticationType.setTransactionKey(process.env.AUTHORIZE_TRANSACTION_KEY);

    const profileToCharge = new APIContracts.CustomerProfilePaymentType();
    profileToCharge.setCustomerProfileId(customerProfileId);
    profileToCharge.setPaymentProfile({
      paymentProfileId: customerPaymentProfileId,
    });

    const transactionRequestType = new APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequestType.setAmount(parseFloat(amount)); // Ensure it's a number
    transactionRequestType.setProfile(profileToCharge);
    transactionRequestType.setOrder({ invoiceNumber: orderId });

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequestType);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response != null && response.getMessages().getResultCode() === "Ok") {
        return res.status(200).json({
          success: true,
          transactionId: response.getTransactionResponse().getTransId(),
        });
      } else {
        const errorMessages = response.getMessages().getMessage();
        return res.status(500).json({
          success: false,
          error: errorMessages[0].getText(),
        });
      }
    });
  } catch (err) {
    console.error("❌ Error in /payment:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Heroku server is running and ready on port ${PORT}`);
});
