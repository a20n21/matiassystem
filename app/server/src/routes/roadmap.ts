import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const STATUS = ['proximo', 'andamento', 'feito'] as const;

const itemSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).default(''),
  trilha_id: z.number().int().positive().nullable().default(null),
  status: z.enum(STATUS).default('proximo'),
  periodo: z.string().trim().max(40).default(''),
});
const updateSchema = z.object({
  titulo: itemSchema.shape.titulo.optional(),
  descricao: z.string().trim().max(1000).optional(),
  trilha_id: z.number().int().positive().nullable().optional(),
  status: z.enum(STATUS).optional(),
  periodo: z.string().trim().max(40).optional(),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

// Próxima posição no fim da coluna
const FIM_DA_COLUNA = '(SELECT coalesce(max(ordem), 0) + 1 FROM roadmap_itens WHERE status = $1)';

export async function roadmapRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/roadmap', async () => {
    const { rows } = await pool.query(`
      SELECT r.*, t.nome AS trilha_nome, t.cor AS trilha_cor
      FROM roadmap_itens r LEFT JOIN trilhas t ON t.id = r.trilha_id
      ORDER BY r.ordem, r.id`);
    return rows;
  });

  app.post('/api/roadmap', async (request, reply) => {
    const r = itemSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO roadmap_itens (status, titulo, descricao, trilha_id, periodo, ordem)
       VALUES ($1, $2, $3, $4, $5, ${FIM_DA_COLUNA}) RETURNING *`,
      [r.status, r.titulo, r.descricao, r.trilha_id, r.periodo]);
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/roadmap/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const r = updateSchema.parse(request.body);
    const campos = Object.entries(r).filter(([, v]) => v !== undefined);
    if (campos.length === 0) return reply.code(400).send({ erro: 'Nada para atualizar' });

    const params: unknown[] = [];
    const sets: string[] = [];
    for (const [coluna, valor] of campos) {
      params.push(valor);
      sets.push(`${coluna} = $${params.length}`);
    }
    if (r.status) {
      // Mudou de coluna: vai para o fim da coluna nova
      params.push(r.status);
      const p = `$${params.length}`;
      sets.push(`ordem = CASE WHEN status = ${p} THEN ordem
                 ELSE (SELECT coalesce(max(ordem), 0) + 1 FROM roadmap_itens WHERE status = ${p}) END`);
    }
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE roadmap_itens SET ${sets.join(', ')}, atualizado_em = now()
       WHERE id = $${params.length} RETURNING *`, params);
    return rows[0] ?? reply.code(404).send({ erro: 'Item não encontrado' });
  });

  app.delete('/api/roadmap/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rowCount } = await pool.query('DELETE FROM roadmap_itens WHERE id = $1', [id]);
    return rowCount ? { ok: true } : reply.code(404).send({ erro: 'Item não encontrado' });
  });
}
