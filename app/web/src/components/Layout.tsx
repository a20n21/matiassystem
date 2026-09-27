import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Home, Layers, LogOut, Map, Settings } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../api';
import { useSessao } from '../auth';
import { CronometroWidget } from './Cronometro';

const NAV = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/estudos', label: 'Meus estudos', icon: BookOpen, end: false },
  { to: '/trilhas', label: 'Trilhas', icon: Layers, end: false },
  { to: '/roadmap', label: 'Roadmap', icon: Map, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
];

export function Layout() {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSettled: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });
  const usuario = sessao?.usuario ?? '';

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><BookOpen size={18} /></span>
          <span className="brand-text">Matias<span>System</span></span>
        </NavLink>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-link" title={label}>
            <Icon size={19} /><span>{label}</span>
          </NavLink>
        ))}
        <CronometroWidget />
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{usuario.slice(0, 1).toUpperCase()}</span>
            {usuario}
          </div>
          <button className="nav-link nav-button" onClick={() => logout.mutate()} title="Sair">
            <LogOut size={19} /><span>Sair</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
