import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { pool } from '../db.js';

// Duração de uma sessão em segundos (a que está rodando conta até agora)
const DURACAO = 'extract(epoch FROM coalesce(s.fim, now()) - s.inicio)';

/** Tudo que a tela de Início precisa, numa chamada só */
export async function painelRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/painel', async () => {
    const tz = config.timezone;
    const [contagens, trilhas, estudando, roadmap, recentes, tempo, dias] = await Promise.all([
      pool.query(`SELECT status, count(*)::int AS total FROM estudos GROUP BY status`),
      pool.query(`
        SELECT t.id, t.nome, t.cor,
               count(e.id)::int AS total,
               count(e.id) FILTER (WHERE e.status = 'concluido')::int AS concluidos,
               coalesce(round(avg(e.progresso)), 0)::int AS progresso
        FROM trilhas t LEFT JOIN estudos e ON e.trilha_id = t.id
        GROUP BY t.id ORDER BY t.ordem, t.nome`),
      pool.query(`
        SELECT e.id, e.titulo, e.progresso, e.atualizado_em, t.nome AS trilha_nome, t.cor AS trilha_cor
        FROM estudos e LEFT JOIN trilhas t ON t.id = e.trilha_id
        WHERE e.status = 'estudando' ORDER BY e.atualizado_em DESC LIMIT 5`),
      pool.query(`
        SELECT r.id, r.titulo, r.status, r.periodo, t.nome AS trilha_nome, t.cor AS trilha_cor
        FROM roadmap_itens r LEFT JOIN trilhas t ON t.id = r.trilha_id
        WHERE r.status IN ('andamento', 'proximo')
        ORDER BY (r.status = 'andamento') DESC, r.ordem LIMIT 5`),
      pool.query(`
        SELECT e.id, e.titulo, e.status, e.atualizado_em, t.nome AS trilha_nome, t.cor AS trilha_cor
        FROM estudos e LEFT JOIN trilhas t ON t.id = e.trilha_id
        ORDER BY e.atualizado_em DESC LIMIT 5`),
      // "Hoje" e "semana" (a partir de segunda) no fuso do usuário
      pool.query(`
        SELECT
          coalesce(sum(${DURACAO}) FILTER (
            WHERE (s.inicio AT TIME ZONE $1) >= date_trunc('day', now() AT TIME ZONE $1)), 0)::int AS hoje_seg,
          coalesce(sum(${DURACAO}) FILTER (
            WHERE (s.inicio AT TIME ZONE $1) >= date_trunc('week', now() AT TIME ZONE $1)), 0)::int AS semana_seg,
          coalesce(sum(${DURACAO}), 0)::int AS total_seg
        FROM sessoes_estudo s`, [tz]),
      pool.query(`
        SELECT to_char(d, 'YYYY-MM-DD') AS dia, coalesce(sum(${DURACAO}), 0)::int AS seg
        FROM generate_series(date_trunc('day', now() AT TIME ZONE $1) - interval '6 days',
                             date_trunc('day', now() AT TIME ZONE $1), interval '1 day') AS d
        LEFT JOIN sessoes_estudo s ON date_trunc('day', s.inicio AT TIME ZONE $1) = d
        GROUP BY d ORDER BY d`, [tz]),
    ]);

    const porStatus = Object.fromEntries(contagens.rows.map((r) => [r.status, r.total]));
    return {
      contagens: {
        planejado: porStatus.planejado ?? 0,
        estudando: porStatus.estudando ?? 0,
        concluido: porStatus.concluido ?? 0,
      },
      trilhas: trilhas.rows,
      estudando: estudando.rows,
      roadmap: roadmap.rows,
      recentes: recentes.rows,
      tempo: { ...tempo.rows[0], ultimos_7_dias: dias.rows },
    };
  });
}
