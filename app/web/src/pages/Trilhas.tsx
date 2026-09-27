import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, type Trilha } from '../api';
import { TrilhaForm, useTrilhas } from '../components/forms';
import { useToast } from '../components/Toasts';
import { corVar, EmptyState, Modal, ProgressBar, Spinner } from '../components/ui';

export function Trilhas() {
  const { data: trilhas, isLoading } = useTrilhas();
  const [nova, setNova] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const criar = useMutation({
    mutationFn: (v: Pick<Trilha, 'nome' | 'descricao' | 'cor'>) => api.post<Trilha>('/api/trilhas', v),
    onSuccess: (t) => {
      qc.invalidateQueries();
      toast('Trilha criada');
      navigate(`/trilhas/${t.id}`);
    },
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Trilhas</h1>
          <p className="page-sub">Cada trilha é um currículo: um checklist de estudos para acompanhar do início ao fim.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNova(true)}><Plus size={17} />Nova trilha</button>
      </header>

      {isLoading || !trilhas ? (
        <div className="center"><Spinner /></div>
      ) : trilhas.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Layers size={30} />} title="Nenhuma trilha ainda">
            <span>Crie uma trilha para organizar seus estudos por assunto.</span>
            <button className="btn btn-primary btn-sm" onClick={() => setNova(true)}><Plus size={15} />Nova trilha</button>
          </EmptyState>
        </div>
      ) : (
        <div className="trilha-grid">
          {trilhas.map((t) => (
            <Link key={t.id} to={`/trilhas/${t.id}`} className="card trilha-card" style={corVar(t.cor)}>
              <div className="trilha-card-head">
                <h3>{t.nome}</h3>
                <span className="trilha-pct">{t.progresso}%</span>
              </div>
              <p>{t.descricao || 'Sem descrição'}</p>
              <ProgressBar value={t.progresso} cor={t.cor} showLabel={false} />
              <span className="list-meta">
                {t.total_estudos === 0
                  ? 'Checklist vazio'
                  : `${t.concluidos} de ${t.total_estudos} ${t.total_estudos === 1 ? 'item concluído' : 'itens concluídos'}`}
              </span>
            </Link>
          ))}
          <button className="card trilha-card trilha-card-new" onClick={() => setNova(true)}>
            <Plus size={24} />
            <span>Nova trilha</span>
          </button>
        </div>
      )}

      {nova && (
        <Modal title="Nova trilha" onClose={() => setNova(false)}>
          <TrilhaForm onSubmit={(v) => criar.mutate(v)} onCancel={() => setNova(false)}
            busy={criar.isPending} erro={criar.error?.message} />
        </Modal>
      )}
    </div>
  );
}
