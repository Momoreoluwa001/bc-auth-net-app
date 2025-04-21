const express = require('express');
const fs = require('fs');
const path = require('path');
const { APIContracts, APIControllers } = require('authorizenet');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Path to JSON database
const subscriptionsPath = path.join(__dirname, 'subscriptions.json');

// Helper to load saved subscriptions
function loadSubscriptions() {
  if (!fs.existsSync(subscriptionsPath)) {
    fs.writeFileSync(subscriptionsPath, JSON.stringify([]));
  }
  const data = fs.readFileSync(subscriptionsPath);
  return JSON.parse(data);
}

// Helper to save all subscriptions
function saveSubscriptions(subscriptions) {
  fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptions, null, 2));
}

// Helper to add a new subscription
function addSubscription(subscription) {
  const subscriptions = loadSubscriptions();
  subscriptions.push(subscription);
  saveSubscriptions(subscriptions);
}

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('✅ Heroku server is running and ready!');
});

// ✅ Payment processing route
app.post('/payment', async (req, res) => {
  try {
    const { amount, customerProfileId, customerPaymentProfileId, orderId } = req.body;

    if (!amount || !customerProfileId || !customerPaymentProfileId) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const merchantAuthentication = new APIContracts.MerchantAuthenticationType();
    merchantAuthentication.setName(process.env.AUTHORIZE_API_LOGIN_ID);
    merchantAuthentication.setTransactionKey(process.env.AUTHORIZE_TRANSACTION_KEY);

    const paymentProfile = new APIContracts.PaymentProfile();
    paymentProfile.setPaymentProfileId(customerPaymentProfileId);

    const profileToCharge = new APIContracts.CustomerProfilePaymentType();
    profileToCharge.setCustomerProfileId(customerProfileId);
    profileToCharge.setPaymentProfile(paymentProfile);

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setAmount(parseFloat(amount));
    transactionRequest.setProfile(profileToCharge);

    if (orderId) {
      const orderDetails = new APIContracts.OrderType();
      orderDetails.setInvoiceNumber(orderId);
      transactionRequest.setOrder(orderDetails);
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthentication);
    createRequest.setTransactionRequest(transactionRequest);

    const controller = new APIControllers.CreateTransactionController(createRequest.getJSON());

    controller.execute(() => {
      const apiResponse = controller.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      const transactionResponse = response.getTransactionResponse();

      console.log('🧾 Full Authorize.Net Response:', JSON.stringify(apiResponse, null, 2));

      if (
        response &&
        response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK &&
        transactionResponse &&
        transactionResponse.getResponseCode() === '1'
      ) {
        return res.json({
          success: true,
          transactionId: transactionResponse.getTransId(),
          authCode: transactionResponse.getAuthCode(),
          message: transactionResponse.getMessages().getMessage()[0].getDescription(),
        });
      } else {
        let errorMessage = 'Payment failed';

        if (transactionResponse) {
          const errors = transactionResponse.getErrors();
          if (errors) {
            errorMessage = errors.getError()[0].getErrorText();
          } else if (transactionResponse.getMessages()) {
            errorMessage = transactionResponse.getMessages().getMessage()[0].getDescription();
          } else {
            errorMessage = `Transaction response code: ${transactionResponse.getResponseCode()}`;
          }
        } else {
          const messages = response.getMessages();
          if (messages && messages.getMessage().length > 0) {
            errorMessage = messages.getMessage()[0].getText();
          }
        }

        return res.status(400).json({ success: false, message: errorMessage });
      }
    });
  } catch (error) {
    console.error('🔥 Payment error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Subscription creation route (with logging)
app.post('/subscribe', (req, res) => {
  console.log('📦 Received subscription request:', req.body); // <-- Log body

  const {
    bigcommerceCustomerId,
    authNetCustomerProfileId,
    authNetPaymentProfileId,
    subscriptionType,
    startDate
  } = req.body;

  if (
    !bigcommerceCustomerId ||
    !authNetCustomerProfileId ||
    !authNetPaymentProfileId ||
    !subscriptionType ||
    !startDate
  ) {
    console.log('❌ Missing fields:', {
      bigcommerceCustomerId,
      authNetCustomerProfileId,
      authNetPaymentProfileId,
      subscriptionType,
      startDate
    });
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const nextBillingDate = new Date(startDate);
  nextBillingDate.setDate(
    nextBillingDate.getDate() + (subscriptionType === 'bi-monthly' ? 15 : 30)
  );

  const subscription = {
    bigcommerceCustomerId,
    authNetCustomerProfileId,
    authNetPaymentProfileId,
    subscriptionType,
    startDate,
    nextBillingDate: nextBillingDate.toISOString(),
    discountApplied: true,
    status: 'active'
  };

  addSubscription(subscription);

  res.json({ success: true, subscription });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Heroku server is running and ready on port ${PORT}`);
});
