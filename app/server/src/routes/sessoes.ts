import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const iniciarSchema = z.object({
  estudo_id: z.number().int().positive(),
  aula_id: z.number().int().positive().nullable().default(null),
});
const manualSchema = z.object({
  estudo_id: z.number().int().positive(),
  aula_id: z.number().int().positive().nullable().default(null),
  inicio: z.iso.datetime({ offset: true }),
  minutos: z.number().int().min(1).max(24 * 60),
});

// Sessão com o nome do estudo/aula e a duração em segundos (até agora, se ainda estiver rodando)
const SELECT = `
  SELECT s.id, s.estudo_id, s.aula_id, s.inicio, s.fim,
         floor(extract(epoch FROM coalesce(s.fim, now()) - s.inicio))::int AS duracao_seg,
         e.titulo AS estudo_titulo, a.titulo AS aula_titulo, t.cor AS trilha_cor
  FROM sessoes_estudo s
  JOIN estudos e ON e.id = s.estudo_id
  LEFT JOIN aulas a ON a.id = s.aula_id
  LEFT JOIN trilhas t ON t.id = e.trilha_id`;

export async function sessoesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /** Cronômetro ativo (ou null). duracao_seg é calculado no servidor: sem problema de relógio do navegador. */
  app.get('/api/sessoes/ativa', async () => {
    const { rows } = await pool.query(`${SELECT} WHERE s.fim IS NULL`);
    return rows[0] ?? null;
  });

  /** Inicia o cronômetro. Se já houver um rodando, ele é encerrado antes (troca de atividade). */
  app.post('/api/sessoes', async (request, reply) => {
    const s = iniciarSchema.parse(request.body);
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('UPDATE sessoes_estudo SET fim = now() WHERE fim IS NULL');
      const { rows } = await db.query(
        `INSERT INTO sessoes_estudo (estudo_id, aula_id)
         SELECT $1, a.id FROM (SELECT 1) x
         LEFT JOIN aulas a ON a.id = $2 AND a.estudo_id = $1
         RETURNING id`, [s.estudo_id, s.aula_id]);
      await db.query('COMMIT');
      const criada = await pool.query(`${SELECT} WHERE s.id = $1`, [rows[0].id]);
      return reply.code(201).send(criada.rows[0]);
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  });

  app.post('/api/sessoes/:id/parar', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rowCount } = await pool.query('UPDATE sessoes_estudo SET fim = now() WHERE id = $1 AND fim IS NULL', [id]);
    if (!rowCount) return reply.code(404).send({ erro: 'Nenhum cronômetro ativo com esse id' });
    const { rows } = await pool.query(`${SELECT} WHERE s.id = $1`, [id]);
    return rows[0];
  });

  /** Registro manual (esqueceu de ligar o cronômetro) */
  app.post('/api/sessoes/manual', async (request, reply) => {
    const s = manualSchema.parse(request.body);
    const inicio = new Date(s.inicio);
    if (inicio.getTime() > Date.now()) return reply.code(400).send({ erro: 'A data não pode estar no futuro' });
    const { rows } = await pool.query(
      `INSERT INTO sessoes_estudo (estudo_id, aula_id, inicio, fim)
       SELECT $1, a.id, $3::timestamptz, $3::timestamptz + make_interval(mins => $4)
       FROM (SELECT 1) x LEFT JOIN aulas a ON a.id = $2 AND a.estudo_id = $1
       RETURNING id`, [s.estudo_id, s.aula_id, inicio, s.minutos]);
    return reply.code(201).send({ id: rows[0].id });
  });

  app.get('/api/estudos/:id/sessoes', async (request) => {
    const { id } = idParam.parse(request.params);
    const [sessoes, total] = await Promise.all([
      pool.query(`${SELECT} WHERE s.estudo_id = $1 ORDER BY s.inicio DESC LIMIT 50`, [id]),
      pool.query(`SELECT coalesce(sum(extract(epoch FROM coalesce(fim, now()) - inicio)), 0)::int AS total_seg,
                         count(*)::int AS quantidade
                  FROM sessoes_estudo WHERE estudo_id = $1`, [id]),
    ]);
    return { ...total.rows[0], sessoes: sessoes.rows };
  });

  app.delete('/api/sessoes/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rowCount } = await pool.query('DELETE FROM sessoes_estudo WHERE id = $1', [id]);
    return rowCount ? { ok: true } : reply.code(404).send({ erro: 'Sessão não encontrada' });
  });
}
