import toast from 'react-hot-toast';

const fallbackError = 'Something went wrong. Please try again.';

const getErrorMessage = (error) => error?.detail || error?.message || fallbackError;

export const notifySuccess = (message, id) => toast.success(message, id ? { id } : undefined);
export const notifyError = (error, id) => toast.error(getErrorMessage(error), id ? { id } : undefined);
export const notifyInfo = (message, id) => toast(message, id ? { id } : undefined);
