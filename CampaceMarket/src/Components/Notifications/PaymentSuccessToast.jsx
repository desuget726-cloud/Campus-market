import { useEffect } from 'react';
import toast from 'react-hot-toast';

function PaymentSuccessToast() {
  useEffect(() => {
    const handlePaymentVerified = (event) => {
      const message = event.detail?.message;

      if (message) {
        toast.success(message);
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