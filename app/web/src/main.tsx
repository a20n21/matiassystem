import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ApiError } from './api';
import { RequireAuth, useSessaoExpirada } from './auth';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toasts';
import { Configuracoes } from './pages/Configuracoes';
import { Estudo } from './pages/Estudo';
import { Estudos } from './pages/Estudos';
import { Inicio } from './pages/Inicio';
import { Login } from './pages/Login';
import { Roadmap } from './pages/Roadmap';
import { Trilha } from './pages/Trilha';
import { Trilhas } from './pages/Trilhas';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Não insiste em erros do cliente (401, 404...): só em falhas de rede/servidor
      retry: (tentativas, erro) => !(erro instanceof ApiError && erro.status < 500) && tentativas < 2,
    },
  },
});

function App() {
  useSessaoExpirada();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Inicio />} />
        <Route path="estudos" element={<Estudos />} />
        <Route path="estudos/:id" element={<Estudo />} />
        <Route path="trilhas" element={<Trilhas />} />
        <Route path="trilhas/:id" element={<Trilha />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
