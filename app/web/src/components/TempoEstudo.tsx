import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, History, Play, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, type Estudo, type SessoesDoEstudo } from '../api';
import { useDecorrido, useIniciarSessao, useSessaoAtiva } from './Cronometro';
import { useToast } from './Toasts';
import { duracao, EmptyState, Modal, relogio } from './ui';

/** "2026-09-27T14:30" no fuso local, para o <input type="datetime-local"> */
function localInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function TempoEstudo({ estudo }: { estudo: Estudo }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({
    queryKey: ['sessoes', estudo.id],
    queryFn: () => api.get<SessoesDoEstudo>(`/api/estudos/${estudo.id}/sessoes`),
  });
  const { data: ativa } = useSessaoAtiva();
  const decorrido = useDecorrido();
  const iniciar = useIniciarSessao();
  const [manual, setManual] = useState(false);
  const [quando, setQuando] = useState(() => localInput(new Date(Date.now() - 3_600_000)));
  const [minutos, setMinutos] = useState(60);
  const [aulaId, setAulaId] = useState<number | null>(null);

  const rodandoAqui = ativa?.estudo_id === estudo.id;
  // O total do servidor já inclui a sessão ativa até o momento da consulta: soma só o que passou desde então
  const total = (data?.total_seg ?? 0) + (rodandoAqui ? decorrido - (ativa?.duracao_seg ?? 0) : 0);

  const registrar = useMutation({
    mutationFn: () => api.post('/api/sessoes/manual', {
      estudo_id: estudo.id, aula_id: aulaId, inicio: new Date(quando).toISOString(), minutos,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessoes'] });
      qc.invalidateQueries({ queryKey: ['painel'] });
      toast(`${duracao(minutos * 60)} registrados`);
      setManual(false);
    },
  });

  const excluir = useMutation({
    mutationFn: (id: number) => api.del(`/api/sessoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessoes'] });
      qc.invalidateQueries({ queryKey: ['painel'] });
    },
    onError: (e) => toast(e.message, 'erro'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    registrar.mutate();
  };

  return (
    <section className="card">
      <div className="card-title">
        <h2><Clock size={17} />Tempo de estudo</h2>
        <div className="toolbar">
          <button className="btn btn-sm btn-ghost" onClick={() => setManual(true)}><Plus size={15} />Registrar tempo</button>
          {!rodandoAqui && (
            <button className="btn btn-sm btn-primary" onClick={() => iniciar.mutate({ estudo_id: estudo.id })} disabled={iniciar.isPending}>
              <Play size={14} fill="currentColor" />Iniciar cronômetro
            </button>
          )}
        </div>
      </div>

      <div className="tempo-resumo">
        <div>
          <div className="stat-value">{duracao(total)}</div>
          <div className="stat-label">{data?.quantidade ?? 0} {data?.quantidade === 1 ? 'sessão' : 'sessões'} no total</div>
        </div>
        {rodandoAqui && (
          <div className="tempo-agora">
            <span className="timer-dot" />
            <span>Rodando agora{ativa?.aula_titulo && ` · ${ativa.aula_titulo}`}</span>
            <strong className="timer-clock">{relogio(decorrido)}</strong>
          </div>
        )}
      </div>

      {data && data.sessoes.length > 0 ? (
        <details className="historico">
          <summary><History size={15} />Histórico de sessões</summary>
          <ul className="sessoes">
            {data.sessoes.map((s) => (
              <li key={s.id}>
                <span className="sessao-data">
                  {new Date(s.inicio).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="sessao-aula">{s.aula_titulo ?? 'Estudo geral'}</span>
                <strong>{s.fim ? duracao(s.duracao_seg) : 'em andamento'}</strong>
                <button className="icon-btn danger" disabled={!s.fim} onClick={() => excluir.mutate(s.id)}
                  aria-label="Excluir sessão" title={s.fim ? 'Excluir sessão' : 'Pare o cronômetro antes de excluir'}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        !rodandoAqui && (
          <EmptyState icon={<Clock size={26} />} title="Nenhuma sessão registrada">
            <span>Inicie o cronômetro quando começar a estudar, ou use ▶ numa aula específica.</span>
          </EmptyState>
        )
      )}

      {manual && (
        <Modal title="Registrar tempo de estudo" onClose={() => setManual(false)}>
          <form className="form" onSubmit={submit}>
            {registrar.error && <div className="error-box">{registrar.error.message}</div>}
            <div className="field-row">
              <div className="field">
                <label htmlFor="quando">Início</label>
                <input id="quando" type="datetime-local" className="input" value={quando} max={localInput(new Date())}
                  onChange={(e) => setQuando(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="minutos">Duração (minutos)</label>
                <input id="minutos" type="number" className="input" min={1} max={1440} value={minutos}
                  onChange={(e) => setMinutos(Number(e.target.value))} required />
              </div>
            </div>
            {estudo.aulas.length > 0 && (
              <div className="field">
                <label htmlFor="aula">Aula (opcional)</label>
                <select id="aula" className="select" value={aulaId ?? ''} onChange={(e) => setAulaId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Estudo geral</option>
                  {estudo.aulas.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setManual(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={registrar.isPending}>Registrar</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
