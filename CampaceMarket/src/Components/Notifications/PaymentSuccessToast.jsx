import { useEffect } from 'react';
import { notifySuccess } from '../../utils/notify';

function PaymentSuccessToast() {
  useEffect(() => {
    const handlePaymentVerified = (event) => {
      const message = event.detail?.message;

      if (message) {
        notifySuccess(message, 'student-payment-verified');
      }
    };

    window.addEventListener(
      'campace:payment-verified',
      handlePaymentVerified
    );

    return () => {
      window.removeEventListener(
        'campace:payment-verified',
        handlePaymentVerified
      );
    };
  }, []);

  return null;
}

export default PaymentSuccessToast;