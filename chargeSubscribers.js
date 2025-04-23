// chargeSubscribers.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { chargeCustomer } = require("./authorizeNet");
const { createBigCommerceOrder } = require("./bigcommerce");

const subscriptionsFile = path.join(__dirname, "data", "subscriptions.json");

function getTodayDateISO() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function addMonths(date, count) {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + count);
  return newDate.toISOString();
}

function addDays(date, count) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + count);
  return newDate.toISOString();
}

async function processSubscriptions() {
  const raw = fs.readFileSync(subscriptionsFile, "utf-8");
  const subscriptions = JSON.parse(raw);
  const today = getTodayDateISO();

  for (let sub of subscriptions) {
    if (sub.status !== "active") continue;

    const billingDate = new Date(sub.nextBillingDate).toISOString().split("T")[0];
    if (billingDate !== today) continue;

    console.log(`🔄 Processing customer ${sub.bigcommerceCustomerId}`);

    try {
      const chargeResult = await chargeCustomer({
        profileId: sub.authNetCustomerProfileId,
        paymentProfileId: sub.authNetPaymentProfileId,
        amount: sub.productPrice
      });

      if (!chargeResult.success) {
        console.log(`❌ Charge failed for ${sub.bigcommerceCustomerId}`);
        continue;
      }

      const orderResult = await createBigCommerceOrder({
        customerId: sub.bigcommerceCustomerId,
        productId: sub.productId,
        price: sub.productPrice
      });

      if (!orderResult.success) {
        console.log(`⚠️ Order creation failed for ${sub.bigcommerceCustomerId}`);
        continue;
      }

      // Update next billing date
      if (sub.subscriptionType === "monthly") {
        sub.nextBillingDate = addMonths(sub.nextBillingDate, 1);
      } else if (sub.subscriptionType === "bi-monthly") {
        sub.nextBillingDate = addDays(sub.nextBillingDate, 14);
      }

      console.log(`✅ Charged and created order for ${sub.bigcommerceCustomerId}`);

    } catch (err) {
      console.error(`💥 Error with ${sub.bigcommerceCustomerId}:`, err.message);
    }
  }

  // Save updated subscriptions
  fs.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));
  console.log("✅ All due subscriptions processed.");
}

processSubscriptions();
