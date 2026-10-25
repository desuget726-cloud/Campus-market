export const getStudentAccessToken = (user) => {
  const userToken = user?.access_token || user?.accessToken || user?.token || user?.session_token || user?.sessionToken;
  if (userToken) return userToken;

  try {
    const session = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
    return session?.user?.access_token
      || session?.user?.accessToken
      || session?.access_token
      || session?.accessToken
      || '';
  } catch {
    return '';
  }
};

export const filterPublicProducts = (products, user) => {
  if (!Array.isArray(products)) return [];

  const studentId = String(user?.studentId || user?.student_id || '').trim().toLowerCase();
  const studentName = String(user?.name || '').trim().toLowerCase();
  const ownedIdentities = new Set([studentId, studentName].filter(Boolean));
  if (ownedIdentities.size === 0) return products;

  return products.filter((product) => {
    const sellerId = String(product?.seller_id || '').trim().toLowerCase();
    const seller = String(product?.seller || '').trim().toLowerCase();
    return !ownedIdentities.has(sellerId) && !ownedIdentities.has(seller);
  });
};
