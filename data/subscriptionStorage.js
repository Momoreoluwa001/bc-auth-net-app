// data/subscriptionStorage.js

const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, 'subscriptions.json');

// Read all subscriptions
function getAllSubscriptions() {
  return new Promise((resolve, reject) => {
    fs.readFile(STORAGE_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') return resolve([]);
        return reject(err);
      }
      try {
        const subs = JSON.parse(data);
        resolve(subs);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

// Update the next billing date
async function updateNextBillingDate(customerId, subscriptionType) {
  const subscriptions = await getAllSubscriptions();

  const updatedSubs = subscriptions.map(sub => {
    if (sub.bigcommerceCustomerId === customerId) {
      const current = new Date(sub.nextBillingDate || sub.startDate);
      const next = new Date(current);

      if (subscriptionType === 'monthly') {
        next.setMonth(current.getMonth() + 1);
      } else if (subscriptionType === 'bi-monthly') {
        next.setDate(current.getDate() + 14);
      }

      sub.nextBillingDate = next.toISOString();
    }
    return sub;
  });

  fs.writeFileSync(STORAGE_FILE, JSON.stringify(updatedSubs, null, 2));
}

module.exports = {
  getAllSubscriptions,
  updateNextBillingDate,
};
