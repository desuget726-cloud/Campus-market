const getNormalizedProductStatus = (product) => String(product?.status || '').trim().toLowerCase();

export const isAdminProductAvailable = (product) => (
  ['approved', 'active', 'available'].includes(getNormalizedProductStatus(product))
);

export const matchesAdminProductStatusFilter = (product, filter) => {
  const status = getNormalizedProductStatus(product);
  switch (filter) {
    case 'available':
      return isAdminProductAvailable(product);
    case 'sold':
    case 'pending':
    case 'flagged':
      return status === filter;
    default:
      return true;
  }
};

export const getAdminProductStatusCounts = (products) => products.reduce((counts, product) => {
  const status = getNormalizedProductStatus(product);
  counts.total += 1;
  if (isAdminProductAvailable(product)) counts.available += 1;
  if (status === 'sold') counts.sold += 1;
  if (status === 'pending') counts.pending += 1;
  if (status === 'flagged') counts.flagged += 1;
  return counts;
}, { total: 0, available: 0, sold: 0, pending: 0, flagged: 0 });
