import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, FileText, Pencil, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, STATUS_ESTUDO, type Estudo as TEstudo, type EstudoInput, type StatusEstudo } from '../api';
import { Aulas } from '../components/Aulas';
import { TempoEstudo } from '../components/TempoEstudo';
import { EstudoForm } from '../components/forms';
import { Markdown } from '../components/Markdown';
import { useToast } from '../components/Toasts';
import {
  ConfirmDialog, dataCurta, EmptyState, Modal, Spinner, tempoRelativo, TrilhaTag,
} from '../components/ui';

const MODELO = `## Objetivo

O que quero conseguir fazer ao final deste estudo.

## Anotações

-

## Comandos

\`\`\`bash

\`\`\`

## Checklist

- [ ] Entender o conceito
- [ ] Praticar no laboratório
- [ ] Escrever um resumo
`;

export function Estudo() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: estudo, isLoading, error } = useQuery({
    queryKey: ['estudo', id],
    queryFn: () => api.get<TEstudo>(`/api/estudos/${id}`),
  });

  const [aba, setAba] = useState<'ver' | 'editar'>('ver');
  const [rascunho, setRascunho] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [editandoDetalhes, setEditandoDetalhes] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Rascunho só é reiniciado ao abrir outro estudo (não a cada refetch, para não perder o que está sendo digitado)
  useEffect(() => {
    if (estudo) {
      setRascunho(estudo.notas);
      if (!estudo.notas) setAba('editar');
    }
  }, [estudo?.id]);

  // Progresso acompanha o valor salvo (ex.: marcar "Concluído" leva a 100% no servidor)
  useEffect(() => {
    if (estudo) setProgresso(estudo.progresso);
  }, [estudo?.progresso]);

  const salvar = useMutation({
    mutationFn: (v: EstudoInput) => api.put(`/api/estudos/${id}`, v),
    onSuccess: async (_d, v) => {
      await qc.invalidateQueries();
      if (v.notas !== undefined) toast('Anotações salvas');
      else if (v.titulo !== undefined) toast('Estudo atualizado');
      setEditandoDetalhes(false);
    },
    onError: (e) => toast(e.message, 'erro'),
  });

  const excluir = useMutation({
    mutationFn: () => api.del(`/api/estudos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries();
      toast('Estudo excluído');
      navigate('/estudos', { replace: true });
    },
  });

  const alterado = estudo !== undefined && rascunho !== estudo.notas;
  const temAulas = (estudo?.aulas.length ?? 0) > 0;
  const salvarNotas = useCallback(() => {
    if (alterado && !salvar.isPending) salvar.mutate({ notas: rascunho });
  }, [alterado, rascunho, salvar]);

  // Ctrl+S salva; sair da página com alterações pede confirmação
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarNotas();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (alterado) e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [salvarNotas, alterado]);

  // Progresso: salva 600 ms depois da última mudança no controle (depende só do valor local)
  useEffect(() => {
    if (!estudo || progresso === estudo.progresso) return;
    const t = setTimeout(() => salvar.mutate({ progresso }), 600);
    return () => clearTimeout(t);
  }, [progresso]);

  if (isLoading) return <div className="center"><Spinner /></div>;
  if (error || !estudo) {
    return (
      <div className="page">
        <Link to="/estudos" className="back-link"><ArrowLeft size={16} />Meus estudos</Link>
        <div className="card"><EmptyState icon={<FileText size={30} />} title="Estudo não encontrado" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/estudos" className="back-link"><ArrowLeft size={16} />Meus estudos</Link>

      <header className="detail-head">
        <div>
          {estudo.trilha_id
            ? <Link to={`/trilhas/${estudo.trilha_id}`}><TrilhaTag nome={estudo.trilha_nome} cor={estudo.trilha_cor} /></Link>
            : <TrilhaTag nome={null} cor={null} />}
          <h1>{estudo.titulo}</h1>
          {estudo.resumo && <p className="page-sub">{estudo.resumo}</p>}
          <div className="detail-meta">
            <span>Criado em {dataCurta(estudo.criado_em)}</span>
            <span>Atualizado {tempoRelativo(estudo.atualizado_em)}</span>
            {estudo.concluido_em && <span>Concluído em {dataCurta(estudo.concluido_em)}</span>}
            {estudo.tags.length > 0 && <ul className="tags">{estudo.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
          </div>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => setEditandoDetalhes(true)}><Pencil size={16} />Editar detalhes</button>
          <button className="icon-btn danger" onClick={() => setExcluindo(true)} aria-label="Excluir estudo" title="Excluir">
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <section className="card detail-controls">
        <div className="segmented" role="group" aria-label="Status">
          {(Object.keys(STATUS_ESTUDO) as StatusEstudo[]).map((s) => (
            <button key={s} className={estudo.status === s ? 'active' : ''}
              onClick={() => estudo.status !== s && salvar.mutate({ status: s })}>
              {STATUS_ESTUDO[s]}
            </button>
          ))}
        </div>
        <div className="slider-row">
          <label htmlFor="progresso" className="stat-label">Progresso</label>
          {/* Com aulas, o progresso é calculado por elas (o controle fica só de leitura) */}
          <input id="progresso" type="range" min={0} max={100} step={5} value={progresso}
            disabled={temAulas} title={temAulas ? 'Calculado pelas aulas assistidas' : undefined}
            onChange={(e) => setProgresso(Number(e.target.value))} />
          <span className="pct">{progresso}%</span>
        </div>
      </section>

      <Aulas estudo={estudo} />

      <TempoEstudo estudo={estudo} />

      <section className="card">
        <div className="tabs" role="tablist">
          <button role="tab" className={`tab${aba === 'ver' ? ' active' : ''}`} onClick={() => setAba('ver')}>
            <Eye size={16} />Anotações
          </button>
          <button role="tab" className={`tab${aba === 'editar' ? ' active' : ''}`} onClick={() => setAba('editar')}>
            <Pencil size={16} />Editar
          </button>
          <div className="grow" />
          {alterado && <span className="unsaved">● não salvo</span>}
          {aba === 'editar' && (
            <button className="btn btn-primary btn-sm" onClick={salvarNotas} disabled={!alterado || salvar.isPending}
              title="Ctrl+S">
              <Save size={15} />{salvar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>

        {aba === 'ver' ? (
          estudo.notas ? <Markdown>{estudo.notas}</Markdown> : (
            <EmptyState icon={<FileText size={28} />} title="Sem anotações ainda">
              <button className="btn btn-sm" onClick={() => setAba('editar')}><Pencil size={14} />Começar a escrever</button>
            </EmptyState>
          )
        ) : (
          <>
            <div className="notes-editor">
              <textarea className="textarea" value={rascunho} onChange={(e) => setRascunho(e.target.value)}
                placeholder="Escreva em Markdown: ## títulos, - listas, ```código```, - [ ] checklists…"
                aria-label="Anotações em Markdown" spellCheck />
              <div className="notes-preview">
                {rascunho ? <Markdown>{rascunho}</Markdown> : <span className="hint">A pré-visualização aparece aqui.</span>}
              </div>
            </div>
            {!rascunho && (
              <button className="btn btn-sm btn-ghost" onClick={() => setRascunho(MODELO)}>
                <FileText size={14} />Usar modelo de anotação
              </button>
            )}
          </>
        )}
      </section>

      {editandoDetalhes && (
        <Modal title="Editar estudo" onClose={() => setEditandoDetalhes(false)}>
          <EstudoForm editando inicial={estudo}
            onSubmit={(v) => salvar.mutate(v)} onCancel={() => setEditandoDetalhes(false)}
            busy={salvar.isPending} erro={salvar.error?.message} />
        </Modal>
      )}
      {excluindo && (
        <ConfirmDialog title="Excluir estudo"
          message={<>O estudo <strong>{estudo.titulo}</strong> e todas as anotações serão apagados.</>}
          onConfirm={() => excluir.mutate()} onClose={() => setExcluindo(false)} busy={excluir.isPending} />
      )}
    </div>
  );
}
