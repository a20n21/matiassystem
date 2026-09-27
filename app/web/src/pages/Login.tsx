import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Lock, LogIn, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError } from '../api';
import { useSessao } from '../auth';

export function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { de?: string } | null)?.de ?? '/';

  const login = useMutation({
    mutationFn: () => api.post<{ usuario: string }>('/api/auth/login', { usuario, senha }),
    onSuccess: ({ usuario }) => {
      qc.setQueryData(['sessao'], { autenticado: true, usuario });
      navigate(destino, { replace: true });
    },
  });

  if (sessao?.autenticado) return <Navigate to={destino} replace />;

  const erro = login.error instanceof ApiError && login.error.status === 429
    ? 'Muitas tentativas. Aguarde um minuto e tente de novo.'
    : login.error?.message;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark"><BookOpen size={18} /></span>
          <span>Matias<span>System</span></span>
        </div>
        <div>
          <h1>Seus estudos, num só lugar</h1>
          <p className="page-sub">Entre para continuar</p>
        </div>
        {erro && <div className="error-box" role="alert">{erro}</div>}
        <div className="field">
          <label htmlFor="usuario">Usuário</label>
          <div className="input-icon">
            <User size={16} />
            <input id="usuario" className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username" autoFocus required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <div className="input-icon">
            <Lock size={16} />
            <input id="senha" type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password" required />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={login.isPending}>
          <LogIn size={17} />{login.isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
