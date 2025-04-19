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

app.post("/payment", async (req, res) => {
  try {
    const {
      amount,
      customerProfileId,
      customerPaymentProfileId,
      orderId,
    } = req.body;

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
    transactionRequestType.setAmount(amount);
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
        res.status(200).json({ success: true, transactionId: response.getTransactionResponse().getTransId() });
      } else {
        const errorMessage =
