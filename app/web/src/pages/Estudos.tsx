import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Plus, Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, STATUS_ESTUDO, type EstudoInput, type EstudoResumo, type StatusEstudo } from '../api';
import { EstudoForm, useTrilhas } from '../components/forms';
import { useToast } from '../components/Toasts';
import {
  EmptyState, Modal, ProgressBar, Spinner, StatusBadge, tempoRelativo, TrilhaTag,
} from '../components/ui';

export function Estudos() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') as StatusEstudo | null;
  const trilha = params.get('trilha');
  const [busca, setBusca] = useState(params.get('q') ?? '');
  const [novo, setNovo] = useState(false);
  const { data: trilhas = [] } = useTrilhas();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  // Busca com atraso: não consulta a API a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setFiltro('q', busca.trim() || null), 300);
    return () => clearTimeout(t);
  }, [busca]);

  function setFiltro(chave: string, valor: string | null) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (valor) n.set(chave, valor); else n.delete(chave);
      return n;
    }, { replace: true });
  }

  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (trilha) query.set('trilha', trilha);
  if (params.get('q')) query.set('q', params.get('q')!);
  const { data: estudos, isLoading, isFetching } = useQuery({
    queryKey: ['estudos', query.toString()],
    queryFn: () => api.get<EstudoResumo[]>(`/api/estudos?${query}`),
    placeholderData: keepPreviousData,
  });

  const criar = useMutation({
    mutationFn: (v: EstudoInput) => api.post<{ id: number }>('/api/estudos', v),
    onSuccess: ({ id }) => {
      qc.invalidateQueries();
      toast('Estudo criado');
      navigate(`/estudos/${id}`);
    },
  });

  const filtrando = Boolean(status || trilha || params.get('q'));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Meus estudos</h1>
          <p className="page-sub">
            {estudos ? `${estudos.length} ${estudos.length === 1 ? 'estudo' : 'estudos'}` : 'Carregando…'}
            {filtrando && ' com os filtros atuais'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setNovo(true)}><Plus size={17} />Novo estudo</button>
      </header>

      <div className="toolbar">
        <div className="input-icon">
          <Search size={16} />
          <input className="input" placeholder="Buscar em títulos, anotações e tags…" value={busca}
            onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        <select className="select" value={trilha ?? ''} onChange={(e) => setFiltro('trilha', e.target.value || null)} aria-label="Trilha">
          <option value="">Todas as trilhas</option>
          {trilhas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Status">
          <button className={!status ? 'active' : ''} onClick={() => setFiltro('status', null)}>Todos</button>
          {(Object.keys(STATUS_ESTUDO) as StatusEstudo[]).map((s) => (
            <button key={s} className={status === s ? 'active' : ''} onClick={() => setFiltro('status', s)}>
              {STATUS_ESTUDO[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="center"><Spinner /></div>
      ) : estudos && estudos.length > 0 ? (
        <div className={`study-grid${isFetching ? ' fetching' : ''}`}>
          {estudos.map((e) => (
            <Link key={e.id} to={`/estudos/${e.id}`} className="card study-card">
              <div className="study-card-head">
                <TrilhaTag nome={e.trilha_nome} cor={e.trilha_cor} />
                <StatusBadge status={e.status} />
              </div>
              <h3>{e.titulo}</h3>
              {e.resumo && <p>{e.resumo}</p>}
              <ProgressBar value={e.progresso} cor={e.trilha_cor} />
              <div className="study-card-foot">
                {e.tags.length > 0 ? <ul className="tags">{e.tags.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul> : <span />}
                <span className="list-meta">
                  {e.total_aulas > 0 && <span className="aulas-count">{e.aulas_feitas}/{e.total_aulas} aulas</span>}
                  {e.tem_notas && <FileText size={14} aria-label="Tem anotações" />}
                  {tempoRelativo(e.atualizado_em)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : filtrando ? (
        <div className="card">
          <EmptyState icon={<SearchX size={30} />} title="Nenhum estudo encontrado">
            <button className="btn btn-sm" onClick={() => { setBusca(''); setParams({}, { replace: true }); }}>Limpar filtros</button>
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={<BookOpen size={30} />} title="Nenhum estudo ainda">
            <span>Crie o primeiro e comece a registrar o que está aprendendo.</span>
            <button className="btn btn-primary btn-sm" onClick={() => setNovo(true)}><Plus size={15} />Novo estudo</button>
          </EmptyState>
        </div>
      )}

      {novo && (
        <Modal title="Novo estudo" onClose={() => setNovo(false)}>
          <EstudoForm
            inicial={trilha ? { trilha_id: Number(trilha) } : undefined}
            onSubmit={(v) => criar.mutate(v)} onCancel={() => setNovo(false)}
            busy={criar.isPending} erro={criar.error?.message} />
        </Modal>
      )}
    </div>
  );
}
