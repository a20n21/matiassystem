import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, ListPlus, Pencil, Play, Plus, PlayCircle, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, type Aula, type Estudo } from '../api';
import { useIniciarSessao, useSessaoAtiva } from './Cronometro';
import { useToast } from './Toasts';
import { EmptyState, Modal, ProgressBar } from './ui';

/** Checklist das aulas assistidas de um estudo. Progresso e status do estudo são calculados pela API. */
export function Aulas({ estudo }: { estudo: Estudo }) {
  const chave = ['estudo', estudo.id];
  const qc = useQueryClient();
  const toast = useToast();
  const [nova, setNova] = useState('');
  const [emLote, setEmLote] = useState(false);
  const [lote, setLote] = useState('');
  const [editando, setEditando] = useState<{ id: number; titulo: string } | null>(null);
  const aulas = estudo.aulas;
  const iniciar = useIniciarSessao();
  const { data: ativa } = useSessaoAtiva();
  const feitas = aulas.filter((a) => a.concluida).length;
  const pct = aulas.length ? Math.round((100 * feitas) / aulas.length) : 0;

  /** Aplica a mudança na tela na hora; desfaz se a API recusar */
  const otimista = (alterar: (aulas: Aula[]) => Aula[]) => async () => {
    await qc.cancelQueries({ queryKey: chave });
    const anterior = qc.getQueryData<Estudo>(chave);
    if (anterior) qc.setQueryData<Estudo>(chave, { ...anterior, aulas: alterar(anterior.aulas) });
    return { anterior };
  };
  const desfazer = (e: Error, _v: unknown, ctx?: { anterior?: Estudo }) => {
    if (ctx?.anterior) qc.setQueryData(chave, ctx.anterior);
    toast(e.message, 'erro');
  };
  // Progresso/status do estudo mudaram no servidor: atualiza esta tela e as listas
  const sincronizar = () => qc.invalidateQueries();

  const alternar = useMutation({
    mutationFn: (a: Aula) => api.put(`/api/aulas/${a.id}`, { concluida: !a.concluida }),
    onMutate: (a) => otimista((lista) => lista.map((x) => (x.id === a.id ? { ...x, concluida: !x.concluida } : x)))(),
    onError: desfazer,
    onSettled: sincronizar,
  });

  const adicionar = useMutation({
    mutationFn: (titulos: string[]) => api.post<Aula[]>(`/api/estudos/${estudo.id}/aulas`, { titulos }),
    onSuccess: (criadas) => {
      setNova('');
      if (criadas.length > 1) {
        toast(`${criadas.length} aulas adicionadas`);
        setLote('');
        setEmLote(false);
      }
      sincronizar();
    },
    onError: (e) => toast(e.message, 'erro'),
  });

  const renomear = useMutation({
    mutationFn: ({ id, titulo }: { id: number; titulo: string }) => api.put(`/api/aulas/${id}`, { titulo }),
    onMutate: ({ id, titulo }) => otimista((lista) => lista.map((x) => (x.id === id ? { ...x, titulo } : x)))(),
    onError: desfazer,
    onSettled: sincronizar,
  });

  const excluir = useMutation({
    mutationFn: (id: number) => api.del(`/api/aulas/${id}`),
    onMutate: (id) => otimista((lista) => lista.filter((x) => x.id !== id))(),
    onError: desfazer,
    onSettled: sincronizar,
  });

  const reordenar = useMutation({
    mutationFn: (ids: number[]) => api.put(`/api/estudos/${estudo.id}/aulas/ordem`, { ids }),
    onMutate: (ids) => otimista((lista) => ids.map((i) => lista.find((x) => x.id === i)!))(),
    onError: desfazer,
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  });

  const mover = (idx: number, delta: number) => {
    const ids = aulas.map((a) => a.id);
    [ids[idx], ids[idx + delta]] = [ids[idx + delta], ids[idx]];
    reordenar.mutate(ids);
  };
  const submitNova = (e: FormEvent) => {
    e.preventDefault();
    const titulo = nova.trim();
    if (titulo && !adicionar.isPending) adicionar.mutate([titulo]);
  };
  const salvarEdicao = (e: FormEvent) => {
    e.preventDefault();
    if (editando?.titulo.trim()) renomear.mutate({ id: editando.id, titulo: editando.titulo.trim() });
    setEditando(null);
  };
  // Uma aula por linha; ignora linhas vazias e marcadores de lista ("- ", "1. ", "* ")
  const linhasDoLote = lote.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);

  return (
    <section className="card">
      <div className="card-title">
        <h2><PlayCircle size={17} />Aulas</h2>
        <button className="btn btn-sm" onClick={() => setEmLote(true)}><ListPlus size={15} />Adicionar várias</button>
      </div>

      {aulas.length > 0 && (
        <div className="aulas-resumo">
          <ProgressBar value={pct} cor={estudo.trilha_cor} />
          <span className="list-meta">{feitas} de {aulas.length} aulas assistidas</span>
        </div>
      )}

      {aulas.length === 0 ? (
        <EmptyState icon={<PlayCircle size={28} />} title="Nenhuma aula ainda">
          <span>Adicione as aulas do curso e marque cada uma ao assistir. O progresso é calculado sozinho.</span>
        </EmptyState>
      ) : (
        <ul className="checklist">
          {aulas.map((a, idx) => (
            <li key={a.id} className={`check-item${a.concluida ? ' done' : ''}`}>
              <button className="checkbox" role="checkbox" aria-checked={a.concluida}
                aria-label={a.concluida ? `Desmarcar ${a.titulo}` : `Marcar ${a.titulo} como assistida`}
                onClick={() => alternar.mutate(a)}>
                {a.concluida && <Check size={15} strokeWidth={3} />}
              </button>

              {editando?.id === a.id ? (
                <form className="aula-edit" onSubmit={salvarEdicao}>
                  <input className="input" value={editando.titulo} autoFocus maxLength={300}
                    onChange={(e) => setEditando({ id: a.id, titulo: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setEditando(null)} aria-label="Nome da aula" />
                  <button className="icon-btn" type="submit" aria-label="Salvar nome"><Check size={16} /></button>
                  <button className="icon-btn" type="button" onClick={() => setEditando(null)} aria-label="Cancelar"><X size={16} /></button>
                </form>
              ) : (
                <span className="check-title" onDoubleClick={() => setEditando({ id: a.id, titulo: a.titulo })}>
                  <span>{a.titulo}</span>
                </span>
              )}

              <span className="aula-num">{idx + 1}</span>
              <div className="check-order">
                {ativa?.aula_id === a.id ? (
                  <span className="aula-rodando" title="Cronômetro rodando nesta aula"><span className="timer-dot" /></span>
                ) : (
                  <button className="icon-btn play" onClick={() => iniciar.mutate({ estudo_id: estudo.id, aula_id: a.id })}
                    aria-label={`Estudar ${a.titulo} com cronômetro`} title="Estudar esta aula (inicia o cronômetro)">
                    <Play size={14} fill="currentColor" />
                  </button>
                )}
                <button className="icon-btn" onClick={() => setEditando({ id: a.id, titulo: a.titulo })} aria-label="Renomear" title="Renomear">
                  <Pencil size={14} />
                </button>
                <button className="icon-btn" disabled={idx === 0 || reordenar.isPending} onClick={() => mover(idx, -1)}
                  aria-label="Mover para cima" title="Mover para cima"><ArrowUp size={14} /></button>
                <button className="icon-btn" disabled={idx === aulas.length - 1 || reordenar.isPending} onClick={() => mover(idx, 1)}
                  aria-label="Mover para baixo" title="Mover para baixo"><ArrowDown size={14} /></button>
                <button className="icon-btn danger" onClick={() => excluir.mutate(a.id)} aria-label="Excluir aula" title="Excluir">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="quick-add" onSubmit={submitNova}>
        <Plus size={18} />
        <input className="input" value={nova} onChange={(e) => setNova(e.target.value)}
          placeholder="Nome da aula e Enter… (ex.: Aula 3 – VPC e subnets)" maxLength={300} aria-label="Nova aula" />
        <button className="btn btn-sm" type="submit" disabled={!nova.trim() || adicionar.isPending}>Adicionar</button>
      </form>

      {emLote && (
        <Modal title="Adicionar várias aulas" onClose={() => setEmLote(false)}>
          <div className="form">
            <div className="field">
              <label htmlFor="lote">Uma aula por linha</label>
              <textarea id="lote" className="textarea lote" value={lote} onChange={(e) => setLote(e.target.value)}
                placeholder={'Cole aqui o índice do curso, por exemplo:\n\nIntrodução ao IAM\nUsuários, grupos e políticas\nRoles e STS\nVPC e subnets'} />
              <span className="hint">Marcadores como “-”, “*” ou “1.” no início das linhas são removidos.</span>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEmLote(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={linhasDoLote.length === 0 || adicionar.isPending}
                onClick={() => adicionar.mutate(linhasDoLote)}>
                {adicionar.isPending ? 'Adicionando…' : `Adicionar ${linhasDoLote.length || ''} ${linhasDoLote.length === 1 ? 'aula' : 'aulas'}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
