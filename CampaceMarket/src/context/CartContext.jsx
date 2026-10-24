import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';

const CartContext = createContext(null);

const getStudentAccessToken = (user) => {
  const userToken = user?.access_token || user?.accessToken || user?.token || user?.session_token || user?.sessionToken;
  if (userToken) return userToken;

  try {
    const session = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
    return session?.user?.access_token || session?.user?.accessToken || session?.access_token || session?.accessToken || '';
  } catch {
    return '';
  }
};

export function CartProvider({ user, children }) {
  const studentId = String(user?.studentId || user?.student_id || '').trim();
  const [items, setItems] = useState([]);
  const [loadedStudentId, setLoadedStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const refreshCart = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!studentId) {
      setItems([]);
      setLoadedStudentId('');
      setError('');
      return [];
    }

    setLoading(true);
    setError('');
    try {
      const token = getStudentAccessToken(user);
      const response = await fetch(
        `${API_BASE_URL}/api/student/cart?student_id=${encodeURIComponent(studentId)}`,
        { cache: 'no-store', ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.detail;
        throw new Error(typeof detail === 'string' ? detail : detail?.message || 'Unable to load your cart.');
      }
      const cartItems = Array.isArray(data.items) ? data.items : [];
      if (requestId === requestIdRef.current) {
        setItems(cartItems);
        setLoadedStudentId(studentId);
      }
      return cartItems;
    } catch (cartError) {
      if (requestId === requestIdRef.current) {
        setError(cartError.message || 'Unable to load your cart.');
      }
      throw cartError;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [studentId, user]);

  useEffect(() => {
    if (!studentId) {
      requestIdRef.current += 1;
      return undefined;
    }

    Promise.resolve().then(() => refreshCart()).catch((cartError) => {
      console.error('Unable to load the buyer cart:', cartError);
    });
  }, [refreshCart, studentId]);

  const value = useMemo(() => ({
    items: studentId && loadedStudentId === studentId ? items : [],
    setItems,
    loadedStudentId,
    loading: Boolean(studentId && loading),
    error: studentId ? error : '',
    refreshCart,
  }), [studentId, items, loadedStudentId, loading, error, refreshCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// This hook is intentionally exported beside its provider for shared cart access.
// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider.');
  }
  return context;
}
