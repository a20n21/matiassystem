import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
  api, STATUS_ESTUDO, STATUS_ROADMAP,
  type EstudoInput, type RoadmapInput, type StatusEstudo, type StatusRoadmap, type Trilha,
} from '../api';

export function useTrilhas() {
  return useQuery({ queryKey: ['trilhas'], queryFn: () => api.get<Trilha[]>('/api/trilhas') });
}

function TrilhaSelect({ id, value, onChange }: { id: string; value: number | null; onChange: (v: number | null) => void }) {
  const { data: trilhas = [] } = useTrilhas();
  return (
    <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Sem trilha</option>
      {trilhas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
    </select>
  );
}

function FormActions({ onCancel, busy, label }: { onCancel: () => void; busy: boolean; label: string }) {
  return (
    <div className="form-actions">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : label}</button>
    </div>
  );
}

// ---------- Estudo ----------
export function EstudoForm({ inicial, editando = false, onSubmit, onCancel, busy, erro }: {
  inicial?: EstudoInput;
  editando?: boolean;
  onSubmit: (v: EstudoInput) => void;
  onCancel: () => void;
  busy: boolean;
  erro?: string | null;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [resumo, setResumo] = useState(inicial?.resumo ?? '');
  const [trilhaId, setTrilhaId] = useState<number | null>(inicial?.trilha_id ?? null);
  const [status, setStatus] = useState<StatusEstudo>(inicial?.status ?? 'planejado');
  const [tags, setTags] = useState((inicial?.tags ?? []).join(', '));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      titulo, resumo, trilha_id: trilhaId, status,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      {erro && <div className="error-box">{erro}</div>}
      <div className="field">
        <label htmlFor="titulo">Título</label>
        <input id="titulo" className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Services e Ingress no Kubernetes" required maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="resumo">Resumo</label>
        <input id="resumo" className="input" value={resumo} onChange={(e) => setResumo(e.target.value)}
          placeholder="Uma linha sobre o que é este estudo" maxLength={500} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="trilha">Trilha</label>
          <TrilhaSelect id="trilha" value={trilhaId} onChange={setTrilhaId} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" className="select" value={status} onChange={(e) => setStatus(e.target.value as StatusEstudo)}>
            {Object.entries(STATUS_ESTUDO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="tags">Tags</label>
        <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="kubectl, redes, ingress" />
        <span className="hint">Separadas por vírgula</span>
      </div>
      <FormActions onCancel={onCancel} busy={busy} label={editando ? 'Salvar' : 'Criar estudo'} />
    </form>
  );
}

// ---------- Item do roadmap ----------
export function RoadmapForm({ inicial, editando = false, onSubmit, onCancel, busy, erro }: {
  inicial?: RoadmapInput;
  editando?: boolean;
  onSubmit: (v: RoadmapInput) => void;
  onCancel: () => void;
  busy: boolean;
  erro?: string | null;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [trilhaId, setTrilhaId] = useState<number | null>(inicial?.trilha_id ?? null);
  const [status, setStatus] = useState<StatusRoadmap>(inicial?.status ?? 'proximo');
  const [periodo, setPeriodo] = useState(inicial?.periodo ?? '');

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit({ titulo, descricao, trilha_id: trilhaId, status, periodo }); }}>
      {erro && <div className="error-box">{erro}</div>}
      <div className="field">
        <label htmlFor="rm-titulo">Título</label>
        <input id="rm-titulo" className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Prometheus e Grafana" required maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="rm-desc">Descrição</label>
        <textarea id="rm-desc" className="textarea" value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="O que significa concluir este item?" maxLength={1000} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="rm-trilha">Trilha</label>
          <TrilhaSelect id="rm-trilha" value={trilhaId} onChange={setTrilhaId} />
        </div>
        <div className="field">
          <label htmlFor="rm-status">Coluna</label>
          <select id="rm-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as StatusRoadmap)}>
            {Object.entries(STATUS_ROADMAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="rm-periodo">Período</label>
        <input id="rm-periodo" className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex.: 2026 T4, Novembro" maxLength={40} />
      </div>
      <FormActions onCancel={onCancel} busy={busy} label={editando ? 'Salvar' : 'Adicionar'} />
    </form>
  );
}

// ---------- Trilha ----------
export function TrilhaForm({ inicial, editando = false, onSubmit, onCancel, busy, erro }: {
  inicial?: Pick<Trilha, 'nome' | 'descricao' | 'cor'>;
  editando?: boolean;
  onSubmit: (v: Pick<Trilha, 'nome' | 'descricao' | 'cor'>) => void;
  onCancel: () => void;
  busy: boolean;
  erro?: string | null;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [cor, setCor] = useState(inicial?.cor ?? '#38bdf8');

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit({ nome, descricao, cor }); }}>
      {erro && <div className="error-box">{erro}</div>}
      <div className="field">
        <label htmlFor="tr-nome">Nome</label>
        <div className="toolbar">
          <input type="color" className="color-input" value={cor} onChange={(e) => setCor(e.target.value)} aria-label="Cor da trilha" />
          <input id="tr-nome" className="input grow" value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Linux" required maxLength={80} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="tr-desc">Descrição</label>
        <input id="tr-desc" className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} />
      </div>
      <FormActions onCancel={onCancel} busy={busy} label={editando ? 'Salvar' : 'Criar trilha'} />
    </form>
  );
}
