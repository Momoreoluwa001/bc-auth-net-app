const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Authorize.Net SDK
const { APIContracts, APIControllers } = require('authorizenet');

// Middleware to parse JSON
app.use(express.json());

// Root route to confirm server is live
app.get('/', (req, res) => {
  res.send('✅ Heroku server is running and ready!');
});

// Real payment processing route
app.post('/payment', async (req, res) => {
  try {
    const { amount, customerProfileId, customerPaymentProfileId, orderId } = req.body;

    if (!amount || !customerProfileId || !customerPaymentProfileId) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Create the payment transaction request
    const paymentType = new APIContracts.CustomerProfilePaymentType();
    paymentType.setCustomerProfileId(customerProfileId);
    paymentType.setPaymentProfile({ paymentProfileId: customerPaymentProfileId });

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setAmount(amount);
    transactionRequest.setProfile(paymentType);
    if (orderId) {
      transactionRequest.setOrder({ invoiceNumber: orderId });
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication({
      name: process.env.AUTHORIZE_API_LOGIN_ID,
      transactionKey: process.env.AUTHORIZE_TRANSACTION_KEY,
    });
    createRequest.setTransactionRequest(transactionRequest);

    const controller = new APIControllers.CreateTransactionController(createRequest.getJSON());

    controller.execute(() => {
      const apiResponse = controller.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (
        response &&
        response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK &&
        response.getTransactionResponse().getResponseCode() === '1'
      ) {
        return res.json({
          success: true,
          transactionId: response.getTransactionResponse().getTransId(),
          authCode: response.getTransactionResponse().getAuthCode(),
          message: response.getTransactionResponse().getMessages().getMessage()[0].getDescription(),
        });
      } else {
        const errorMessage = response.getTransactionResponse()?.getErrors()?.getError()[0]?.getErrorText() || 'Payment failed';
        return res.status(400).json({ success: false, message: errorMessage });
      }
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
