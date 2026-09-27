import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Square, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, type SessaoEstudo } from '../api';
import { useToast } from './Toasts';
import { corVar, duracao, Modal, relogio } from './ui';

export function useSessaoAtiva() {
  return useQuery({
    queryKey: ['sessao-ativa'],
    queryFn: () => api.get<SessaoEstudo | null>('/api/sessoes/ativa'),
    refetchInterval: 60_000, // outro dispositivo pode ter iniciado/parado
  });
}

/** Segundos decorridos: base calculada pelo servidor + o tempo desde a última consulta */
export function useDecorrido(): number {
  const { data: ativa, dataUpdatedAt } = useSessaoAtiva();
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!ativa) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativa]);
  if (!ativa) return 0;
  return ativa.duracao_seg + Math.max(0, (agora - dataUpdatedAt) / 1000);
}

export function useIniciarSessao() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (v: { estudo_id: number; aula_id?: number | null }) => api.post<SessaoEstudo>('/api/sessoes', v),
    onSuccess: (sessao) => {
      qc.setQueryData(['sessao-ativa'], sessao);
      qc.invalidateQueries({ queryKey: ['sessoes'] });
      qc.invalidateQueries({ queryKey: ['painel'] });
      toast(`Cronômetro iniciado: ${sessao.aula_titulo ?? sessao.estudo_titulo}`);
    },
    onError: (e) => toast(e.message, 'erro'),
  });
}

/** Cronômetro sempre visível no menu enquanto houver uma sessão ativa */
export function CronometroWidget() {
  const { data: ativa } = useSessaoAtiva();
  const decorrido = useDecorrido();
  const qc = useQueryClient();
  const toast = useToast();
  const [perguntarAula, setPerguntarAula] = useState<SessaoEstudo | null>(null);

  // Título da aba mostra o tempo (dá para acompanhar de outra aba)
  useEffect(() => {
    const original = 'MatiasSystem · Estudos';
    document.title = ativa ? `⏱ ${relogio(decorrido)} · ${ativa.estudo_titulo}` : original;
  }, [ativa, decorrido]);

  const parar = useMutation({
    mutationFn: (id: number) => api.post<SessaoEstudo>(`/api/sessoes/${id}/parar`),
    onSuccess: (sessao) => {
      qc.setQueryData(['sessao-ativa'], null);
      qc.invalidateQueries({ queryKey: ['sessoes'] });
      qc.invalidateQueries({ queryKey: ['painel'] });
      toast(`Sessão salva: ${duracao(sessao.duracao_seg)} em ${sessao.estudo_titulo}`);
      if (sessao.aula_id) setPerguntarAula(sessao);
    },
    onError: (e) => toast(e.message, 'erro'),
  });

  const marcarAula = useMutation({
    mutationFn: (aulaId: number) => api.put(`/api/aulas/${aulaId}`, { concluida: true }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast('Aula marcada como assistida');
      setPerguntarAula(null);
    },
  });

  return (
    <>
      {ativa && (
        <div className="timer-widget" style={corVar(ativa.trilha_cor)}>
          <div className="timer-head">
            <span className="timer-dot" />
            <span className="timer-label">Estudando agora</span>
          </div>
          <Link to={`/estudos/${ativa.estudo_id}`} className="timer-title" title={ativa.estudo_titulo}>
            {ativa.estudo_titulo}
            {ativa.aula_titulo && <small>{ativa.aula_titulo}</small>}
          </Link>
          <div className="timer-row">
            <Timer size={16} />
            <span className="timer-clock">{relogio(decorrido)}</span>
            <button className="btn btn-danger btn-sm" onClick={() => parar.mutate(ativa.id)} disabled={parar.isPending}
              aria-label="Parar cronômetro" title="Parar e salvar a sessão">
              <Square size={13} fill="currentColor" /><span>Parar</span>
            </button>
          </div>
        </div>
      )}

      {perguntarAula?.aula_id != null && (
        <Modal title="Aula assistida?" onClose={() => setPerguntarAula(null)}>
          <div className="form">
            <p className="page-sub">
              Você estudou <strong>{perguntarAula.aula_titulo}</strong> por {duracao(perguntarAula.duracao_seg)}.
              Quer marcar a aula como assistida?
            </p>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setPerguntarAula(null)}>Ainda não</button>
              <button className="btn btn-primary" onClick={() => marcarAula.mutate(perguntarAula.aula_id!)} disabled={marcarAula.isPending}>
                Sim, marcar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
