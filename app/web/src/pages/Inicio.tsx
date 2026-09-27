import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Clock, Flame, Layers, Map, Plus, Sparkles, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, type EstudoInput, type Painel } from '../api';
import { useSessao } from '../auth';
import { EstudoForm } from '../components/forms';
import { useToast } from '../components/Toasts';
import {
  corVar, duracao, EmptyState, Modal, ProgressBar, Spinner, StatusBadge, tempoRelativo, TrilhaTag,
} from '../components/ui';

const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/** Tempo estudado: hoje, semana e barras dos últimos 7 dias */
function TempoSemana({ tempo }: { tempo: Painel['tempo'] }) {
  const maior = Math.max(...tempo.ultimos_7_dias.map((d) => d.seg), 1);
  return (
    <section className="card tempo-card">
      <div className="tempo-numeros">
        <div className="card-title"><h2><Timer size={17} />Tempo de estudo</h2></div>
        <div className="tempo-kpis">
          <div><div className="stat-value">{duracao(tempo.hoje_seg)}</div><div className="stat-label">Hoje</div></div>
          <div><div className="stat-value">{duracao(tempo.semana_seg)}</div><div className="stat-label">Esta semana</div></div>
          <div><div className="stat-value">{duracao(tempo.total_seg)}</div><div className="stat-label">No total</div></div>
        </div>
      </div>
      <div className="barras" role="img" aria-label="Tempo de estudo nos últimos 7 dias">
        {tempo.ultimos_7_dias.map((d, i) => {
          // "2026-09-27" ao meio-dia local: evita o dia "voltar" por causa do fuso
          const data = new Date(`${d.dia}T12:00:00`);
          const hoje = i === tempo.ultimos_7_dias.length - 1;
          return (
            <div key={d.dia} className={`barra${hoje ? ' hoje' : ''}`} title={`${data.toLocaleDateString('pt-BR')}: ${duracao(d.seg)}`}>
              <span className="barra-valor">{d.seg > 0 ? duracao(d.seg) : ''}</span>
              <div className="barra-trilho"><div style={{ height: `${Math.max(d.seg > 0 ? 4 : 0, (100 * d.seg) / maior)}%` }} /></div>
              <span className="barra-dia">{hoje ? 'hoje' : DIA_SEMANA.format(data).replace('.', '')}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Inicio() {
  const { data: sessao } = useSessao();
  const { data, isLoading } = useQuery({ queryKey: ['painel'], queryFn: () => api.get<Painel>('/api/painel') });
  const [novo, setNovo] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const criar = useMutation({
    mutationFn: (v: EstudoInput) => api.post<{ id: number }>('/api/estudos', v),
    onSuccess: ({ id }) => {
      qc.invalidateQueries();
      toast('Estudo criado');
      navigate(`/estudos/${id}`);
    },
  });

  if (isLoading || !data) return <div className="center"><Spinner /></div>;
  const { contagens } = data;
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{saudacao()}, {sessao?.usuario}</h1>
          <p className="page-sub">{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNovo(true)}><Plus size={17} />Novo estudo</button>
      </header>

      <section className="stats">
        <Link to="/estudos?status=estudando" className="card stat">
          <span className="stat-icon" style={corVar('#38bdf8')}><Flame size={22} /></span>
          <div><div className="stat-value">{contagens.estudando}</div><div className="stat-label">Estudando agora</div></div>
        </Link>
        <Link to="/estudos?status=concluido" className="card stat">
          <span className="stat-icon" style={corVar('#34d399')}><CheckCircle2 size={22} /></span>
          <div><div className="stat-value">{contagens.concluido}</div><div className="stat-label">Concluídos</div></div>
        </Link>
        <Link to="/estudos?status=planejado" className="card stat">
          <span className="stat-icon" style={corVar('#a78bfa')}><Clock size={22} /></span>
          <div><div className="stat-value">{contagens.planejado}</div><div className="stat-label">Planejados</div></div>
        </Link>
        <Link to="/trilhas" className="card stat">
          <span className="stat-icon" style={corVar('#fbbf24')}><Layers size={22} /></span>
          <div><div className="stat-value">{data.trilhas.length}</div><div className="stat-label">Trilhas</div></div>
        </Link>
      </section>

      <TempoSemana tempo={data.tempo} />

      <div className="grid-2">
        <section className="card">
          <div className="card-title">
            <h2><BookOpen size={17} />Continuar estudando</h2>
            <Link to="/estudos?status=estudando" className="btn btn-ghost btn-sm">Ver todos</Link>
          </div>
          {data.estudando.length === 0 ? (
            <EmptyState icon={<Sparkles size={26} />} title="Nada em andamento">
              <span>Mude um estudo para “Estudando” e ele aparece aqui.</span>
            </EmptyState>
          ) : (
            <div className="list">
              {data.estudando.map((e) => (
                <Link key={e.id} to={`/estudos/${e.id}`} className="list-item">
                  <div className="list-item-head">
                    <span className="list-item-title">{e.titulo}</span>
                    <TrilhaTag nome={e.trilha_nome} cor={e.trilha_cor} />
                  </div>
                  <ProgressBar value={e.progresso} cor={e.trilha_cor} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2><Map size={17} />No radar do roadmap</h2>
            <Link to="/roadmap" className="btn btn-ghost btn-sm">Abrir roadmap</Link>
          </div>
          {data.roadmap.length === 0 ? (
            <EmptyState icon={<Map size={26} />} title="Roadmap vazio">
              <Link to="/roadmap">Planeje seus próximos passos</Link>
            </EmptyState>
          ) : (
            <div className="list">
              {data.roadmap.map((r) => (
                <Link key={r.id} to="/roadmap" className="list-item">
                  <div className="list-item-head">
                    <span className="list-item-title">{r.titulo}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="list-meta">
                    <TrilhaTag nome={r.trilha_nome} cor={r.trilha_cor} />
                    {r.periodo && <span>{r.periodo}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-title"><h2><Layers size={17} />Progresso por trilha</h2></div>
        {data.trilhas.map((t) => (
          <div key={t.id} className="trilha-progress">
            <Link to={`/trilhas/${t.id}`}><TrilhaTag nome={t.nome} cor={t.cor} /></Link>
            <ProgressBar value={t.progresso} cor={t.cor} />
            <span className="count">{t.concluidos}/{t.total} concluídos</span>
          </div>
        ))}
      </section>

      {data.recentes.length > 0 && (
        <section className="card">
          <div className="card-title"><h2><Clock size={17} />Atualizados recentemente</h2></div>
          <div className="list">
            {data.recentes.map((e) => (
              <Link key={e.id} to={`/estudos/${e.id}`} className="list-item">
                <div className="list-item-head">
                  <span className="list-item-title">{e.titulo}</span>
                  <StatusBadge status={e.status} />
                </div>
                <div className="list-meta">
                  <TrilhaTag nome={e.trilha_nome} cor={e.trilha_cor} />
                  <span>{tempoRelativo(e.atualizado_em)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {novo && (
        <Modal title="Novo estudo" onClose={() => setNovo(false)}>
          <EstudoForm onSubmit={(v) => criar.mutate(v)} onCancel={() => setNovo(false)}
            busy={criar.isPending} erro={criar.error?.message} />
        </Modal>
      )}
    </div>
  );
}
