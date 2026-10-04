import toast from 'react-hot-toast';

const fallbackError = 'Something went wrong. Please try again.';

const getErrorMessage = (error) => typeof error === 'string'
    ? error
    : error?.detail || error?.message || fallbackError;

export const notifySuccess = (message, id) => toast.success(message, id ? { id } : undefined);
export const notifyError = (error, id) => toast.error(getErrorMessage(error), id ? { id } : undefined);
export const notifyInfo = (message, id) => toast(message, {
    ...(id ? { id } : {}),
    style: {
        background: '#16A34A',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: '12px 18px',
        fontWeight: 600,
    },
});
