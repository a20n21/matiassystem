// ---------- Tipos (espelham as respostas da API) ----------
export type StatusEstudo = 'planejado' | 'estudando' | 'concluido';
export type StatusRoadmap = 'proximo' | 'andamento' | 'feito';

export interface Trilha {
  id: number;
  nome: string;
  descricao: string;
  cor: string;
  ordem: number;
  total_estudos: number;
  concluidos: number;
  progresso: number; // % do checklist concluído
}

/** Item do checklist da trilha (um estudo) */
export interface ItemChecklist {
  id: number;
  titulo: string;
  resumo: string;
  status: StatusEstudo;
  progresso: number;
  tags: string[];
  ordem: number;
  atualizado_em: string;
  concluido_em: string | null;
  tem_notas: boolean;
  total_aulas: number;
  aulas_feitas: number;
}

export interface TrilhaDetalhe extends Trilha {
  estudos: ItemChecklist[];
}

interface ComTrilha {
  trilha_id: number | null;
  trilha_nome: string | null;
  trilha_cor: string | null;
}

export interface EstudoResumo extends ComTrilha {
  id: number;
  titulo: string;
  resumo: string;
  status: StatusEstudo;
  progresso: number;
  tags: string[];
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
  tem_notas: boolean;
  total_aulas: number;
  aulas_feitas: number;
}

/** Aula assistida (checklist dentro do estudo) */
export interface Aula {
  id: number;
  titulo: string;
  concluida: boolean;
  concluida_em: string | null;
  ordem: number;
}

export interface Estudo extends Omit<EstudoResumo, 'tem_notas'> {
  notas: string;
  aulas: Aula[];
}

export interface EstudoInput {
  titulo?: string;
  resumo?: string;
  trilha_id?: number | null;
  status?: StatusEstudo;
  progresso?: number;
  notas?: string;
  tags?: string[];
}

export interface RoadmapItem extends ComTrilha {
  id: number;
  titulo: string;
  descricao: string;
  status: StatusRoadmap;
  periodo: string;
  ordem: number;
}

export interface RoadmapInput {
  titulo?: string;
  descricao?: string;
  trilha_id?: number | null;
  status?: StatusRoadmap;
  periodo?: string;
}

export interface Painel {
  contagens: Record<StatusEstudo, number>;
  trilhas: { id: number; nome: string; cor: string; total: number; concluidos: number; progresso: number }[];
  estudando: (ComTrilha & { id: number; titulo: string; progresso: number; atualizado_em: string })[];
  roadmap: (ComTrilha & { id: number; titulo: string; status: StatusRoadmap; periodo: string })[];
  recentes: (ComTrilha & { id: number; titulo: string; status: StatusEstudo; atualizado_em: string })[];
  tempo: {
    hoje_seg: number;
    semana_seg: number;
    total_seg: number;
    ultimos_7_dias: { dia: string; seg: number }[];
  };
}

export interface Sessao {
  autenticado: boolean;
  usuario: string | null;
}

/** Sessão cronometrada de estudo (fim null = cronômetro rodando) */
export interface SessaoEstudo {
  id: number;
  estudo_id: number;
  aula_id: number | null;
  inicio: string;
  fim: string | null;
  duracao_seg: number;
  estudo_titulo: string;
  aula_titulo: string | null;
  trilha_cor: string | null;
}

export interface SessoesDoEstudo {
  total_seg: number;
  quantidade: number;
  sessoes: SessaoEstudo[];
}

// ---------- Cliente HTTP ----------
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Disparado quando a sessão expira: o app volta para o login */
export const EVENTO_SESSAO_EXPIRADA = 'ms:sessao-expirada';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    // Content-Type só com corpo: a API recusa JSON vazio
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const detalhes = Array.isArray(data?.detalhes) ? ` (${data.detalhes.join('; ')})` : '';
    throw new ApiError(res.status, (data?.erro ?? 'Erro inesperado') + detalhes);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ---------- Rótulos ----------
export const STATUS_ESTUDO: Record<StatusEstudo, string> = {
  planejado: 'Planejado',
  estudando: 'Estudando',
  concluido: 'Concluído',
};

export const STATUS_ROADMAP: Record<StatusRoadmap, string> = {
  proximo: 'Próximo',
  andamento: 'Em andamento',
  feito: 'Feito',
};
