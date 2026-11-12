// Context + hook so any component can raise a toast: toast('ok' | 'error' | 'info', 'message').
import { createContext, useContext } from 'react';

export const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}
