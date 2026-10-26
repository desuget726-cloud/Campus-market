import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPayoutSetupStateAfterMethodChange,
  isPayoutSetupValid,
  isValidPayoutAccountNumber,
} from './payoutSetupValidation.js';

test('changing payout method clears the previously selected provider', () => {
  assert.deepEqual(getPayoutSetupStateAfterMethodChange('mobile_wallet'), {
    payoutType: 'mobile_wallet',
    providerCode: '',
  });
});

test('mobile money numbers require the Ethiopian 09 or 07 format', () => {
  assert.equal(isValidPayoutAccountNumber('mobile_wallet', '855', '0912345678'), true);
  assert.equal(isValidPayoutAccountNumber('mobile_wallet', '855', '0712345678'), true);
  assert.equal(isValidPayoutAccountNumber('mobile_wallet', '855', '0812345678'), false);
  assert.equal(isValidPayoutAccountNumber('mobile_wallet', '855', '091234567'), false);
});

test('invalid account numbers keep payout setup from being saveable', () => {
  assert.equal(isPayoutSetupValid({
    payoutType: 'mobile_wallet',
    providerCode: '855',
    holderName: 'Payout Owner',
    expectedHolderName: 'Payout Owner',
    accountNumber: '0812345678',
  }), false);
  assert.equal(isPayoutSetupValid({
    payoutType: 'mobile_wallet',
    providerCode: '855',
    holderName: 'Payout Owner',
    expectedHolderName: 'Payout Owner',
    accountNumber: '0912345678',
  }), true);
  assert.equal(isPayoutSetupValid({
    payoutType: 'mobile_wallet',
    providerCode: '855',
    holderName: 'Different Person',
    expectedHolderName: 'Payout Owner',
    accountNumber: '0912345678',
  }), false);
});
