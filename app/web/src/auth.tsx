import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, EVENTO_SESSAO_EXPIRADA, type Sessao } from './api';
import { Spinner } from './components/ui';

export function useSessao() {
  return useQuery({
    queryKey: ['sessao'],
    queryFn: () => api.get<Sessao>('/api/auth/sessao'),
    staleTime: 60_000,
  });
}

/** Quando qualquer chamada recebe 401, marca a sessão como encerrada (e o app volta ao login) */
export function useSessaoExpirada() {
  const qc = useQueryClient();
  useEffect(() => {
    const handler = () => qc.setQueryData<Sessao>(['sessao'], { autenticado: false, usuario: null });
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, handler);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, handler);
  }, [qc]);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSessao();
  const location = useLocation();
  if (isLoading) return <div className="center"><Spinner /></div>;
  if (!data?.autenticado) return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  return <>{children}</>;
}
