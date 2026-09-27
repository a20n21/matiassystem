import { X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { STATUS_ESTUDO, STATUS_ROADMAP, type StatusEstudo, type StatusRoadmap } from '../api';

/** Cor dinâmica via variável CSS: o React aplica pelo CSSOM, o que a CSP permite */
export const corVar = (cor: string | null | undefined) => ({ '--c': cor ?? undefined }) as CSSProperties;

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Carregando" />;
}

export function StatusBadge({ status }: { status: StatusEstudo | StatusRoadmap }) {
  const label = (STATUS_ESTUDO as Record<string, string>)[status] ?? (STATUS_ROADMAP as Record<string, string>)[status];
  return <span className={`badge badge-${status}`}>{label}</span>;
}

export function TrilhaTag({ nome, cor }: { nome: string | null; cor: string | null }) {
  if (!nome) return <span className="trilha-tag none">Sem trilha</span>;
  return <span className="trilha-tag" style={corVar(cor)}>{nome}</span>;
}

export function ProgressBar({ value, cor, showLabel = true }: { value: number; cor?: string | null; showLabel?: boolean }) {
  const bar = (
    <div className="progress" style={corVar(cor)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${value}%` }} />
    </div>
  );
  if (!showLabel) return bar;
  return <div className="progress-row">{bar}<span className="pct">{value}%</span></div>;
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // Foco no primeiro campo ao abrir
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button.btn-primary')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Excluir', onConfirm, onClose, busy }: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="form">
        <div className="page-sub">{message}</div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
];
export function tempoRelativo(iso: string): string {
  const seg = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unidade, s] of UNIDADES) {
    if (Math.abs(seg) >= s) return rtf.format(Math.round(seg / s), unidade);
  }
  return 'agora';
}

/** 3725 -> "01:02:05" (cronômetro) */
export function relogio(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

/** 3725 -> "1h 2min" · 1500 -> "25min" · 40 -> "40s" (totais) */
export function duracao(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
