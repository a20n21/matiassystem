import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const titulo = z.string().trim().min(1).max(300);
const novasSchema = z.object({ titulos: z.array(titulo).min(1).max(500) });
const updateSchema = z.object({ titulo: titulo.optional(), concluida: z.boolean().optional() });
const ordemSchema = z.object({ ids: z.array(z.number().int().positive()).max(2000) });

/**
 * Progresso e status do estudo seguem as aulas:
 * nenhuma marcada mantém o status (planejado/estudando), alguma marcada = estudando,
 * todas marcadas = concluído. Estudo sem aulas continua com controle manual.
 */
async function recalcularEstudo(db: PoolClient, estudoId: number): Promise<void> {
  await db.query(`
    WITH c AS (
      SELECT count(*) AS total, count(*) FILTER (WHERE concluida) AS feitas
      FROM aulas WHERE estudo_id = $1
    )
    UPDATE estudos e SET
      progresso = CASE WHEN c.total = 0 THEN e.progresso
                       ELSE round(100.0 * c.feitas / c.total)::int END,
      status = CASE WHEN c.total = 0 THEN e.status
                    WHEN c.feitas = c.total THEN 'concluido'
                    WHEN c.feitas > 0 THEN 'estudando'
                    WHEN e.status = 'concluido' THEN 'estudando'
                    ELSE e.status END,
      concluido_em = CASE WHEN c.total = 0 THEN e.concluido_em
                          WHEN c.feitas = c.total THEN coalesce(e.concluido_em, now())
                          ELSE NULL END,
      atualizado_em = now()
    FROM c WHERE e.id = $1`, [estudoId]);
}

/** Executa numa transação e recalcula o estudo no final (tudo ou nada) */
async function comEstudo<T>(estudoId: number, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await fn(db);
    await recalcularEstudo(db, estudoId);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function estudoDaAula(aulaId: number): Promise<number | null> {
  const { rows } = await pool.query<{ estudo_id: number }>('SELECT estudo_id FROM aulas WHERE id = $1', [aulaId]);
  return rows[0]?.estudo_id ?? null;
}

export async function aulasRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /** Adiciona uma ou várias aulas no fim da lista (ex.: colar o índice do curso) */
  app.post('/api/estudos/:id/aulas', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { titulos } = novasSchema.parse(request.body);
    const existe = await pool.query('SELECT 1 FROM estudos WHERE id = $1', [id]);
    if (!existe.rowCount) return reply.code(404).send({ erro: 'Estudo não encontrado' });

    const criadas = await comEstudo(id, async (db) => {
      const { rows } = await db.query(
        `INSERT INTO aulas (estudo_id, titulo, ordem)
         SELECT $1, t.titulo, (SELECT coalesce(max(ordem), 0) FROM aulas WHERE estudo_id = $1) + t.pos
         FROM unnest($2::text[]) WITH ORDINALITY AS t(titulo, pos)
         RETURNING *`, [id, titulos]);
      return rows;
    });
    return reply.code(201).send(criadas);
  });

  app.put('/api/aulas/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const a = updateSchema.parse(request.body);
    const estudoId = await estudoDaAula(id);
    if (estudoId === null) return reply.code(404).send({ erro: 'Aula não encontrada' });

    return comEstudo(estudoId, async (db) => {
      const { rows } = await db.query(
        `UPDATE aulas SET
           titulo = coalesce($1, titulo),
           concluida = coalesce($2, concluida),
           concluida_em = CASE WHEN $2::boolean IS NULL THEN concluida_em
                               WHEN $2 THEN coalesce(concluida_em, now()) END
         WHERE id = $3 RETURNING *`,
        [a.titulo ?? null, a.concluida ?? null, id]);
      return rows[0];
    });
  });

  app.delete('/api/aulas/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const estudoId = await estudoDaAula(id);
    if (estudoId === null) return reply.code(404).send({ erro: 'Aula não encontrada' });
    await comEstudo(estudoId, (db) => db.query('DELETE FROM aulas WHERE id = $1', [id]));
    return { ok: true };
  });

  /** Nova ordem das aulas: ids do primeiro ao último */
  app.put('/api/estudos/:id/aulas/ordem', async (request) => {
    const { id } = idParam.parse(request.params);
    const { ids } = ordemSchema.parse(request.body);
    await pool.query(
      `UPDATE aulas a SET ordem = o.pos
       FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos)
       WHERE a.id = o.id AND a.estudo_id = $2`, [ids, id]);
    return { ok: true };
  });
}
