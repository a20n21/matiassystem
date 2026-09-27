import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const trilhaSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(500).default(''),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor no formato #rrggbb').default('#38bdf8'),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });
const ordemSchema = z.object({ ids: z.array(z.number().int().positive()).max(1000) });

// Progresso da trilha = média do progresso dos estudos (que vem das aulas assistidas)
const COM_PROGRESSO = `
  SELECT t.*,
         count(e.id)::int AS total_estudos,
         count(e.id) FILTER (WHERE e.status = 'concluido')::int AS concluidos,
         coalesce(round(avg(e.progresso)), 0)::int AS progresso
  FROM trilhas t LEFT JOIN estudos e ON e.trilha_id = t.id`;

export async function trilhasRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/trilhas', async () => {
    const { rows } = await pool.query(`${COM_PROGRESSO} GROUP BY t.id ORDER BY t.ordem, t.nome`);
    return rows;
  });

  /** Trilha com o checklist dos estudos, na ordem definida pelo usuário */
  app.get('/api/trilhas/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rows } = await pool.query(`${COM_PROGRESSO} WHERE t.id = $1 GROUP BY t.id`, [id]);
    if (!rows[0]) return reply.code(404).send({ erro: 'Trilha não encontrada' });
    const estudos = await pool.query(
      `SELECT e.id, e.titulo, e.resumo, e.status, e.progresso, e.tags, e.ordem, e.atualizado_em, e.concluido_em,
              length(e.notas) > 0 AS tem_notas,
              (SELECT count(*)::int FROM aulas a WHERE a.estudo_id = e.id) AS total_aulas,
              (SELECT count(*)::int FROM aulas a WHERE a.estudo_id = e.id AND a.concluida) AS aulas_feitas
       FROM estudos e WHERE e.trilha_id = $1 ORDER BY e.ordem, e.id`, [id]);
    return { ...rows[0], estudos: estudos.rows };
  });

  app.post('/api/trilhas', async (request, reply) => {
    const t = trilhaSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO trilhas (nome, descricao, cor, ordem)
       VALUES ($1, $2, $3, (SELECT coalesce(max(ordem), 0) + 1 FROM trilhas)) RETURNING *`,
      [t.nome, t.descricao, t.cor]);
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/trilhas/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const t = trilhaSchema.parse(request.body);
    const { rows } = await pool.query(
      'UPDATE trilhas SET nome = $1, descricao = $2, cor = $3 WHERE id = $4 RETURNING *',
      [t.nome, t.descricao, t.cor, id]);
    return rows[0] ?? reply.code(404).send({ erro: 'Trilha não encontrada' });
  });

  /** Nova ordem do checklist: ids dos estudos da trilha, do primeiro ao último */
  app.put('/api/trilhas/:id/ordem', async (request) => {
    const { id } = idParam.parse(request.params);
    const { ids } = ordemSchema.parse(request.body);
    // Uma única instrução: cada id recebe sua posição; só estudos desta trilha são afetados
    await pool.query(
      `UPDATE estudos e SET ordem = o.pos
       FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos)
       WHERE e.id = o.id AND e.trilha_id = $2`,
      [ids, id]);
    return { ok: true };
  });

  // Estudos e itens do roadmap da trilha ficam sem trilha (ON DELETE SET NULL)
  app.delete('/api/trilhas/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rowCount } = await pool.query('DELETE FROM trilhas WHERE id = $1', [id]);
    return rowCount ? { ok: true } : reply.code(404).send({ erro: 'Trilha não encontrada' });
  });
}
