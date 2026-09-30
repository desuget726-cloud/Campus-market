const normalized = (value) => String(value || '').trim().toLowerCase();

export const isOrderRefunded = (order) => (
    ['rejected', 'expired', 'refunded'].includes(normalized(order?.status))
    || normalized(order?.payment_status || order?.pay_status) === 'refunded'
    || normalized(order?.refund_status) === 'succeeded'
);

export const shouldShowReceiptActions = (order, role) => (
    role === 'buyer'
    && !isOrderRefunded(order)
    && normalized(order?.payment_status || order?.pay_status) === 'successful'
);