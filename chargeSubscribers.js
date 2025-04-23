// chargeSubscribers.js

require('dotenv').config();
const { getAllSubscriptions, updateNextBillingDate } = require('./data/subscriptionStorage');
const { chargeCustomer } = require('./data/authorizeNet');
const { createOrder } = require('./data/bigcommerce');


const run = async () => {
  console.log('🚀 Starting subscription billing job...');
  const subscriptions = await getAllSubscriptions();

  if (!subscriptions || subscriptions.length === 0) {
    console.log('📭 No active subscriptions found.');
    return;
  }

  for (const sub of subscriptions) {
    try {
      const {
        bigcommerceCustomerId,
        authNetCustomerProfileId,
        authNetPaymentProfileId,
        productId,
        productPrice,
        subscriptionType,
        nextBillingDate
      } = sub;

      // ✅ Only charge if today is the billing date
      // const today = new Date().toISOString().split('T')[0];
// const billingDay = new Date(nextBillingDate).toISOString().split('T')[0];

// if (billingDay !== today) {
//   console.log(`⏭️ Skipping customer ${bigcommerceCustomerId} (not billing day: ${billingDay})`);
//   continue;
// }

console.log(`🧪 Test mode: running charge for customer ${bigcommerceCustomerId}`);


      // ✅ 1. Charge the customer
      const chargeResponse = await chargeCustomer(
        authNetCustomerProfileId,
        authNetPaymentProfileId,
        productPrice
      );

      if (!chargeResponse.success) {
        console.error(`❌ Payment failed for customer ${bigcommerceCustomerId}`);
        continue;
      }

      console.log(`💳 Charged $${productPrice} for customer ${bigcommerceCustomerId}`);

      // ✅ 2. Create BigCommerce order
      const order = await createOrder(
        bigcommerceCustomerId,
        productId,
        productPrice
      );

      if (!order || !order.id) {
        console.error(`❌ Order creation failed for customer ${bigcommerceCustomerId}`);
        continue;
      }

      console.log(`🛒 Created BigCommerce order #${order.id} for customer ${bigcommerceCustomerId}`);

      // ✅ 3. Update next billing date
      await updateNextBillingDate(bigcommerceCustomerId, subscriptionType);
      console.log(`📆 Updated next billing date for customer ${bigcommerceCustomerId}`);

    } catch (err) {
      console.error(`❌ Error with customer ${sub.bigcommerceCustomerId}:`, err.message || err);
    }
  }

  console.log('✅ Subscription billing job finished.');
};

run();