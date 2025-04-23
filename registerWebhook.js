const axios = require('axios');

const BC_STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

const webhookUrl = `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/hooks`;

const webhookData = {
  scope: 'store/order/created',
  destination: `https://bc-auth-net-c8527f0cc72c.herokuapp.com/webhook`,
  is_active: true,
  events_history_enabled: true
};

const headers = {
  'X-Auth-Token': BC_ACCESS_TOKEN,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

axios
  .post(webhookUrl, webhookData, { headers })
  .then((response) => {
    console.log('✅ Webhook registered:', response.data.data);
  })
  .catch((error) => {
    if (error.response) {
      console.error('❌ Error registering webhook:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  });
