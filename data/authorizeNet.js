// data/authorizeNet.js

const api = require('authorizenet').APIContracts;
const controller = require('authorizenet').APIControllers;

require('dotenv').config();

const merchantAuthentication = new api.MerchantAuthenticationType();
merchantAuthentication.setName(process.env.AUTHORIZE_API_LOGIN_ID);
merchantAuthentication.setTransactionKey(process.env.AUTHORIZE_TRANSACTION_KEY);

function chargeCustomer(customerProfileId, paymentProfileId, amount) {
  return new Promise((resolve, reject) => {
    const profileToCharge = new api.CustomerProfilePaymentType();
    profileToCharge.setCustomerProfileId(customerProfileId);
    profileToCharge.setPaymentProfile({
      paymentProfileId: paymentProfileId
    });

    const transactionRequest = new api.TransactionRequestType();
    transactionRequest.setTransactionType(api.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setAmount(amount);
    transactionRequest.setProfile(profileToCharge);

    const createRequest = new api.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthentication);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new controller.CreateTransactionController(createRequest.getJSON());
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const json = JSON.parse(response);

      const result = json.transactionResponse;
      if (json.messages.resultCode === 'Ok' && result && result.responseCode === '1') {
        resolve(result);
      } else {
        reject(new Error(result?.errors?.error[0]?.errorText || 'Charge failed'));
      }
    });
  });
}

module.exports = {
  chargeCustomer,
};
