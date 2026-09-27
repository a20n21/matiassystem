import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Check, FileText, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type ItemChecklist, type Trilha as TTrilha, type TrilhaDetalhe } from '../api';
import { TrilhaForm } from '../components/forms';
import { useToast } from '../components/Toasts';
import { ConfirmDialog, corVar, EmptyState, Modal, ProgressBar, Spinner, StatusBadge } from '../components/ui';

export function Trilha() {
  const id = Number(useParams().id);
  const chave = ['trilha', id];
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: trilha, isLoading, error } = useQuery({
    queryKey: chave,
    queryFn: () => api.get<TrilhaDetalhe>(`/api/trilhas/${id}`),
  });
  const [novoItem, setNovoItem] = useState('');
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const atualizarOutrasTelas = () => {
    qc.invalidateQueries({ queryKey: ['trilhas'] });
    qc.invalidateQueries({ queryKey: ['painel'] });
    qc.invalidateQueries({ queryKey: ['estudos'] });
  };

  /** Atualiza o checklist na tela antes do servidor responder (e desfaz se falhar) */
  function otimista(alterar: (itens: ItemChecklist[]) => ItemChecklist[]) {
    return async () => {
      await qc.cancelQueries({ queryKey: chave });
      const anterior = qc.getQueryData<TrilhaDetalhe>(chave);
      if (anterior) {
        const estudos = alterar(anterior.estudos);
        const concluidos = estudos.filter((e) => e.status === 'concluido').length;
        qc.setQueryData<TrilhaDetalhe>(chave, {
          ...anterior, estudos, concluidos,
          progresso: estudos.length ? Math.round((100 * concluidos) / estudos.length) : 0,
        });
      }
      return { anterior };
    };
  }
  const desfazer = (e: Error, _v: unknown, ctx?: { anterior?: TrilhaDetalhe }) => {
    if (ctx?.anterior) qc.setQueryData(chave, ctx.anterior);
    toast(e.message, 'erro');
  };
  const sincronizar = () => {
    qc.invalidateQueries({ queryKey: chave });
    atualizarOutrasTelas();
  };

  const reordenar = useMutation({
    mutationFn: (ids: number[]) => api.put(`/api/trilhas/${id}/ordem`, { ids }),
    onMutate: (ids) => otimista((itens) => ids.map((i) => itens.find((x) => x.id === i)!))(),
    onError: desfazer,
    onSettled: sincronizar,
  });

  const adicionar = useMutation({
    mutationFn: (titulo: string) => api.post('/api/estudos', { titulo, trilha_id: id }),
    onSuccess: () => {
      setNovoItem('');
      sincronizar();
    },
    onError: (e) => toast(e.message, 'erro'),
  });

  const salvarTrilha = useMutation({
    mutationFn: (v: Pick<TTrilha, 'nome' | 'descricao' | 'cor'>) => api.put(`/api/trilhas/${id}`, v),
    onSuccess: () => {
      sincronizar();
      toast('Trilha atualizada');
      setEditando(false);
    },
  });

  const excluirTrilha = useMutation({
    mutationFn: () => api.del(`/api/trilhas/${id}`),
    onSuccess: () => {
      atualizarOutrasTelas();
      toast('Trilha excluída');
      navigate('/trilhas', { replace: true });
    },
  });

  if (isLoading) return <div className="center"><Spinner /></div>;
  if (error || !trilha) {
    return (
      <div className="page">
        <Link to="/trilhas" className="back-link"><ArrowLeft size={16} />Trilhas</Link>
        <div className="card"><EmptyState icon={<ListChecks size={30} />} title="Trilha não encontrada" /></div>
      </div>
    );
  }

  const itens = trilha.estudos;
  const mover = (idx: number, delta: number) => {
    const ids = itens.map((i) => i.id);
    [ids[idx], ids[idx + delta]] = [ids[idx + delta], ids[idx]];
    reordenar.mutate(ids);
  };
  const submitNovo = (e: FormEvent) => {
    e.preventDefault();
    const titulo = novoItem.trim();
    if (titulo && !adicionar.isPending) adicionar.mutate(titulo);
  };

  return (
    <div className="page">
      <Link to="/trilhas" className="back-link"><ArrowLeft size={16} />Trilhas</Link>

      <header className="card trilha-hero" style={corVar(trilha.cor)}>
        <div className="detail-head">
          <div>
            <h1>{trilha.nome}</h1>
            {trilha.descricao && <p className="page-sub">{trilha.descricao}</p>}
          </div>
          <div className="toolbar">
            <button className="btn" onClick={() => setEditando(true)}><Pencil size={16} />Editar</button>
            <button className="icon-btn danger" onClick={() => setExcluindo(true)} aria-label="Excluir trilha" title="Excluir">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <div className="trilha-hero-progress">
          <ProgressBar value={trilha.progresso} cor={trilha.cor} />
          <span className="list-meta">{trilha.concluidos} de {trilha.total_estudos} concluídos</span>
        </div>
      </header>

      <section className="card">
        <div className="card-title"><h2><ListChecks size={17} />Estudos da trilha</h2></div>

        {itens.length === 0 ? (
          <EmptyState icon={<ListChecks size={28} />} title="Nenhum estudo nesta trilha">
            <span>Adicione abaixo os cursos, livros ou certificações desta trilha. Dentro de cada um você marca as aulas assistidas.</span>
          </EmptyState>
        ) : (
          <ul className="checklist">
            {itens.map((item, idx) => {
              const feito = item.status === 'concluido';
              return (
                <li key={item.id} className={`check-item estudo-item${feito ? ' done' : ''}`}>
                  <span className={`status-dot ${item.status}`} title={item.status}>
                    {feito && <Check size={13} strokeWidth={3} />}
                  </span>
                  <Link to={`/estudos/${item.id}`} className="check-title">
                    <span>{item.titulo}</span>
                    <small>
                      {item.total_aulas > 0 ? `${item.aulas_feitas}/${item.total_aulas} aulas` : 'Sem aulas cadastradas'}
                      {item.resumo && ` · ${item.resumo}`}
                    </small>
                  </Link>
                  <div className="check-meta estudo-meta">
                    {item.tem_notas && <FileText size={14} aria-label="Tem anotações" />}
                    <StatusBadge status={item.status} />
                    <div className="mini-progress"><ProgressBar value={item.progresso} cor={trilha.cor} /></div>
                  </div>
                  <div className="check-order">
                    <button className="icon-btn" disabled={idx === 0 || reordenar.isPending} onClick={() => mover(idx, -1)}
                      aria-label="Mover para cima" title="Mover para cima"><ArrowUp size={15} /></button>
                    <button className="icon-btn" disabled={idx === itens.length - 1 || reordenar.isPending} onClick={() => mover(idx, 1)}
                      aria-label="Mover para baixo" title="Mover para baixo"><ArrowDown size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form className="quick-add" onSubmit={submitNovo}>
          <Plus size={18} />
          <input className="input" value={novoItem} onChange={(e) => setNovoItem(e.target.value)}
            placeholder="Adicionar estudo (curso, livro, certificação) e Enter…" maxLength={200} aria-label="Novo estudo da trilha" />
          <button className="btn btn-sm" type="submit" disabled={!novoItem.trim() || adicionar.isPending}>Adicionar</button>
        </form>
      </section>

      {editando && (
        <Modal title="Editar trilha" onClose={() => setEditando(false)}>
          <TrilhaForm editando inicial={trilha} onSubmit={(v) => salvarTrilha.mutate(v)} onCancel={() => setEditando(false)}
            busy={salvarTrilha.isPending} erro={salvarTrilha.error?.message} />
        </Modal>
      )}
      {excluindo && (
        <ConfirmDialog title="Excluir trilha"
          message={<>A trilha <strong>{trilha.nome}</strong> será removida. Os {trilha.total_estudos} estudos dela continuam
            existindo em “Meus estudos”, mas ficam sem trilha.</>}
          onConfirm={() => excluirTrilha.mutate()} onClose={() => setExcluindo(false)} busy={excluirTrilha.isPending} />
      )}
    </div>
  );
}
