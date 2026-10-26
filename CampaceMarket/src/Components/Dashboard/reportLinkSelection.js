export function applyReportLinkSelection(current, type, target) {
  if (type === 'student') {
    return { ...current, seller_id: target.student_id };
  }
  if (type === 'product') {
    return {
      ...current,
      product_id: String(target.id),
      ...(target.seller_id ? { seller_id: target.seller_id } : {}),
    };
  }
  if (type === 'order') {
    return {
      ...current,
      order_id: String(target.id),
      product_id: String(target.product_id),
      ...(target.seller_id ? { seller_id: target.seller_id } : {}),
    };
  }
  return current;
}
