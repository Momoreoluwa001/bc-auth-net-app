const sdk = require('authorizenet');
const { APIContracts, APIControllers } = sdk;

const MERCHANT_AUTH = new APIContracts.MerchantAuthenticationType();
MERCHANT_AUTH.setName(process.env.AUTHORIZE_API_LOGIN_ID);
MERCHANT_AUTH.setTransactionKey(process.env.AUTHORIZE_TRANSACTION_KEY);

function chargeCustomerProfile(customerProfileId, paymentProfileId, amount) {
  return new Promise((resolve, reject) => {
    const profileToCharge = new APIContracts.CustomerProfilePaymentType();
    profileToCharge.setCustomerProfileId(customerProfileId);
    profileToCharge.setCustomerPaymentProfileId(paymentProfileId);

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setAmount(amount);
    transactionRequest.setProfile(profileToCharge);

    const request = new APIContracts.CreateTransactionRequest();
    request.setMerchantAuthentication(MERCHANT_AUTH);
    request.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(request.getJSON());
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
        const transactionResponse = response.getTransactionResponse();
        if (transactionResponse.getResponseCode() === '1') {
          resolve(transactionResponse);
        } else {
          reject(transactionResponse.getErrors());
        }
      } else {
        reject(response.getMessages().getMessage());
      }
    });
  });
}

module.exports = { chargeCustomerProfile };
