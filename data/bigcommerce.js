// bigcommerce.js

const axios = require('axios');

const storeHash = process.env.BC_STORE_HASH;
const accessToken = process.env.BC_ACCESS_TOKEN;

const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v2`;

const headers = {
  'X-Auth-Token': accessToken,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

// Create a BigCommerce order (minimal version)
async function createOrder(customerId, productId, productPrice) {
  try {
    const orderData = {
      customer_id: customerId,
      products: [
        {
          product_id: productId,
          quantity: 1,
          price_ex_tax: productPrice,
        }
      ],
      status_id: 11  // "Awaiting Fulfillment"
    };

    const response = await axios.post(`${baseUrl}/orders`, orderData, { headers });
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create BigCommerce order:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  createOrder
};
