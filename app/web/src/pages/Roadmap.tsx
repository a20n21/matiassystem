import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, STATUS_ROADMAP, type RoadmapInput, type RoadmapItem, type StatusRoadmap } from '../api';
import { RoadmapForm } from '../components/forms';
import { useToast } from '../components/Toasts';
import { ConfirmDialog, Modal, Spinner, TrilhaTag } from '../components/ui';

const COLUNAS: StatusRoadmap[] = ['proximo', 'andamento', 'feito'];

type Edicao = { modo: 'novo'; status: StatusRoadmap } | { modo: 'editar'; item: RoadmapItem };

export function Roadmap() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: itens, isLoading } = useQuery({ queryKey: ['roadmap'], queryFn: () => api.get<RoadmapItem[]>('/api/roadmap') });
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [excluindo, setExcluindo] = useState<RoadmapItem | null>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['roadmap'] });
    qc.invalidateQueries({ queryKey: ['painel'] });
  };

  const salvar = useMutation({
    mutationFn: (v: RoadmapInput) =>
      edicao?.modo === 'editar' ? api.put(`/api/roadmap/${edicao.item.id}`, v) : api.post('/api/roadmap', v),
    onSuccess: () => {
      invalidar();
      toast(edicao?.modo === 'editar' ? 'Item atualizado' : 'Item adicionado');
      setEdicao(null);
    },
  });

  // Mover entre colunas: atualiza a tela na hora e confirma com o servidor
  const mover = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusRoadmap }) => api.put(`/api/roadmap/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['roadmap'] });
      const anterior = qc.getQueryData<RoadmapItem[]>(['roadmap']);
      qc.setQueryData<RoadmapItem[]>(['roadmap'], (lista) =>
        lista?.map((i) => (i.id === id ? { ...i, status, ordem: Number.MAX_SAFE_INTEGER } : i)));
      return { anterior };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(['roadmap'], ctx?.anterior);
      toast(e.message, 'erro');
    },
    onSettled: invalidar,
  });

  const excluir = useMutation({
    mutationFn: (id: number) => api.del(`/api/roadmap/${id}`),
    onSuccess: () => {
      invalidar();
      toast('Item excluído');
      setExcluindo(null);
    },
  });

  if (isLoading || !itens) return <div className="center"><Spinner /></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Roadmap</h1>
          <p className="page-sub">O que vem pela frente, o que está em andamento e o que já foi conquistado.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdicao({ modo: 'novo', status: 'proximo' })}>
          <Plus size={17} />Novo item
        </button>
      </header>

      <div className="board">
        {COLUNAS.map((coluna, idx) => {
          const daColuna = itens.filter((i) => i.status === coluna).sort((a, b) => a.ordem - b.ordem);
          return (
            <section key={coluna} className={`column ${coluna}`} aria-label={STATUS_ROADMAP[coluna]}>
              <div className="column-head">
                <h2>{STATUS_ROADMAP[coluna]}<span className="column-count">{daColuna.length}</span></h2>
                <button className="icon-btn" onClick={() => setEdicao({ modo: 'novo', status: coluna })}
                  aria-label={`Adicionar em ${STATUS_ROADMAP[coluna]}`} title="Adicionar">
                  <Plus size={18} />
                </button>
              </div>

              {daColuna.length === 0 && <div className="column-empty">Nenhum item</div>}

              {daColuna.map((item) => (
                <article key={item.id} className="rm-card">
                  <h3>{item.titulo}</h3>
                  {item.descricao && <p>{item.descricao}</p>}
                  <div className="rm-card-meta">
                    <TrilhaTag nome={item.trilha_nome} cor={item.trilha_cor} />
                    {item.periodo && <span className="period">{item.periodo}</span>}
                  </div>
                  <div className="rm-actions">
                    <div>
                      <button className="icon-btn" disabled={idx === 0} title={idx > 0 ? `Mover para ${STATUS_ROADMAP[COLUNAS[idx - 1]]}` : undefined}
                        aria-label="Mover para a coluna anterior" onClick={() => mover.mutate({ id: item.id, status: COLUNAS[idx - 1] })}>
                        <ChevronLeft size={17} />
                      </button>
                      <button className="icon-btn" disabled={idx === COLUNAS.length - 1}
                        title={idx < COLUNAS.length - 1 ? `Mover para ${STATUS_ROADMAP[COLUNAS[idx + 1]]}` : undefined}
                        aria-label="Mover para a próxima coluna" onClick={() => mover.mutate({ id: item.id, status: COLUNAS[idx + 1] })}>
                        <ChevronRight size={17} />
                      </button>
                    </div>
                    <div>
                      <button className="icon-btn" onClick={() => setEdicao({ modo: 'editar', item })} aria-label="Editar" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn danger" onClick={() => setExcluindo(item)} aria-label="Excluir" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {edicao && (
        <Modal title={edicao.modo === 'editar' ? 'Editar item' : 'Novo item do roadmap'} onClose={() => setEdicao(null)}>
          <RoadmapForm
            inicial={edicao.modo === 'editar' ? edicao.item : { status: edicao.status }}
            editando={edicao.modo === 'editar'}
            onSubmit={(v) => salvar.mutate(v)} onCancel={() => setEdicao(null)}
            busy={salvar.isPending} erro={salvar.error?.message} />
        </Modal>
      )}
      {excluindo && (
        <ConfirmDialog title="Excluir item" message={<>Remover <strong>{excluindo.titulo}</strong> do roadmap?</>}
          onConfirm={() => excluir.mutate(excluindo.id)} onClose={() => setExcluindo(null)} busy={excluir.isPending} />
      )}
    </div>
  );
}
