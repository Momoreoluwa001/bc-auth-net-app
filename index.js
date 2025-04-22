const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { APIContracts, APIControllers } = require('authorizenet');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

const subscriptionsPath = path.join(__dirname, 'subscriptions.json');

function loadSubscriptions() {
  if (!fs.existsSync(subscriptionsPath)) {
    fs.writeFileSync(subscriptionsPath, JSON.stringify([]));
  }
  const data = fs.readFileSync(subscriptionsPath);
  return JSON.parse(data);
}

function saveSubscriptions(subscriptions) {
  fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptions, null, 2));
}

function addSubscription(subscription) {
  const subscriptions = loadSubscriptions();
  subscriptions.push(subscription);
  saveSubscriptions(subscriptions);
}

app.get('/', (req, res) => {
  res.send('✅ Heroku server is running and ready!');
});

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

app.post('/subscribe', async (req, res) => {
  const {
    bigcommerceCustomerId,
    authNetCustomerProfileId,
    authNetPaymentProfileId,
    subscriptionType,
    startDate,
    productId
  } = req.body;

  if (
    !bigcommerceCustomerId ||
    !authNetCustomerProfileId ||
    !authNetPaymentProfileId ||
    !subscriptionType ||
    !startDate ||
    !productId
  ) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const productRes = await axios.get(
      `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/catalog/products/${productId}`,
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN,
          Accept: 'application/json'
        }
      }
    );

    const productPrice = parseFloat(productRes.data.data.price);
    const discountRate = 0.15;
    const discountedPrice = parseFloat((productPrice * (1 - discountRate)).toFixed(2));

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
      status: 'active',
      productId,
      productPrice: discountedPrice
    };

    addSubscription(subscription);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ Failed to fetch product from BigCommerce:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch product info from BigCommerce' });
  }
});

app.post('/process-subscriptions', async (req, res) => {
  const now = new Date();
  const subscriptions = loadSubscriptions();
  const results = [];

  for (const subscription of subscriptions) {
    const nextBillingDate = new Date(subscription.nextBillingDate);

    if (nextBillingDate <= now && subscription.status === 'active') {
      const transaction = await processSubscriptionPayment(subscription);

      if (transaction.success) {
        const intervalDays = subscription.subscriptionType === 'monthly' ? 30 : 15;
        subscription.nextBillingDate = new Date(
          nextBillingDate.setDate(nextBillingDate.getDate() + intervalDays)
        ).toISOString();

        await createBigCommerceOrder(subscription.bigcommerceCustomerId, transaction.transactionId);

        results.push({
          customerId: subscription.bigcommerceCustomerId,
          status: 'charged',
          transactionId: transaction.transactionId
        });
      } else {
        results.push({
          customerId: subscription.bigcommerceCustomerId,
          status: 'failed',
          error: transaction.message
        });
      }
    }
  }

  saveSubscriptions(subscriptions);
  res.json({ processed: results });
});

async function processSubscriptionPayment(subscription) {
  return new Promise((resolve) => {
    const {
      authNetCustomerProfileId,
      authNetPaymentProfileId,
      productPrice
    } = subscription;

    const merchantAuthentication = new APIContracts.MerchantAuthenticationType();
    merchantAuthentication.setName(process.env.AUTHORIZE_API_LOGIN_ID);
    merchantAuthentication.setTransactionKey(process.env.AUTHORIZE_TRANSACTION_KEY);

    const paymentProfile = new APIContracts.PaymentProfile();
    paymentProfile.setPaymentProfileId(authNetPaymentProfileId);

    const profileToCharge = new APIContracts.CustomerProfilePaymentType();
    profileToCharge.setCustomerProfileId(authNetCustomerProfileId);
    profileToCharge.setPaymentProfile(paymentProfile);

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setAmount(parseFloat(productPrice));
    transactionRequest.setProfile(profileToCharge);

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthentication);
    createRequest.setTransactionRequest(transactionRequest);

    const controller = new APIControllers.CreateTransactionController(createRequest.getJSON());

    controller.execute(() => {
      const apiResponse = controller.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);
      const transactionResponse = response.getTransactionResponse();

      console.log('📋 Auto-charge response:', JSON.stringify(apiResponse, null, 2));

      if (
        response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK &&
        transactionResponse &&
        transactionResponse.getResponseCode() === '1'
      ) {
        resolve({
          success: true,
          transactionId: transactionResponse.getTransId(),
        });
      } else {
        let message = 'Unknown error';
        if (transactionResponse?.getErrors()?.getError()?.[0]) {
          message = transactionResponse.getErrors().getError()[0].getErrorText();
        }
        resolve({ success: false, message });
      }
    });
  });
}

async function createBigCommerceOrder(customerId, transactionId) {
  try {
    const productRes = await axios.get(
      `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/catalog/products`,
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN,
          Accept: 'application/json'
        },
        params: {
          tag: 'auto-subscribe',
          availability: 'available'
        }
      }
    );

    const products = productRes.data.data.map(p => ({
      product_id: p.id,
      quantity: 1
    }));

    if (!products.length) throw new Error('No auto-subscribe products available.');

    const response = await axios.post(
      `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders`,
      {
        customer_id: customerId,
        status_id: 2,
        products,
        payment_method: 'Authorize.Net Subscription',
        external_source: 'Authorize.Net',
        external_id: transactionId
      },
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    console.log('🛒 BigCommerce order created:', response.data.id);
  } catch (err) {
    console.error('❌ Failed to create BigCommerce order:', err.response?.data || err.message);
  }
}

app.listen(PORT, () => {
  console.log(`✅ Heroku server is running and ready on port ${PORT}`);
});
