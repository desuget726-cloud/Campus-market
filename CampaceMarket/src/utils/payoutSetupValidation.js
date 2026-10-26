export const getPayoutSetupStateAfterMethodChange = (payoutType) => ({
  payoutType,
  providerCode: '',
});

export const isValidPayoutAccountNumber = (payoutType, providerCode, accountNumber) => {
  if (payoutType === 'mobile_wallet') {
    return /^(09|07)\d{8}$/.test(accountNumber);
  }

  if (providerCode.toLowerCase() === 'comari') {
    return /^\d{13}$/.test(accountNumber);
  }

  return /^\d{10,15}$/.test(accountNumber);
};

export const isPayoutSetupValid = ({
  payoutType,
  providerCode,
  holderName,
  expectedHolderName,
  accountNumber,
}) => Boolean(
  providerCode
  && holderName.trim()
  && (!expectedHolderName
    || holderName.trim().replace(/\s+/g, ' ').toLowerCase()
      === expectedHolderName.trim().replace(/\s+/g, ' ').toLowerCase())
  && isValidPayoutAccountNumber(payoutType, providerCode, accountNumber),
);
