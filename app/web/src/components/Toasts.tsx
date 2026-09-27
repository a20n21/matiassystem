import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tipo = 'ok' | 'erro';
interface Toast { id: number; tipo: Tipo; texto: string }

const ToastContext = createContext<(texto: string, tipo?: Tipo) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((texto: string, tipo: Tipo = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`}>
            {t.tipo === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
