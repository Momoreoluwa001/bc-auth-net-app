const axios = require('axios');
require('dotenv').config();

async function registerWebhook() {
  try {
    const response = await axios.post(
      `https://api.bigcommerce.com/stores/${process.env.BIGCOMMERCE_STORE_HASH}/v3/hooks`,
      {
        scope: 'store/order/created',
        destination: 'https://bc-auth-net-c8527f0cc72c.herokuapp.com/webhook',
        is_active: true
      },
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN,
          'X-Auth-Client': process.env.BIGCOMMERCE_CLIENT_ID,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('✅ Webhook registered successfully:', response.data);
  } catch (error) {
    console.error('❌ Failed to register webhook:', error.response?.data || error.message);
  }
}

registerWebhook();
