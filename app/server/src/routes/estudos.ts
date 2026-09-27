import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const STATUS = ['planejado', 'estudando', 'concluido'] as const;

const estudoSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  resumo: z.string().trim().max(500).default(''),
  trilha_id: z.number().int().positive().nullable().default(null),
  status: z.enum(STATUS).default('planejado'),
  progresso: z.number().int().min(0).max(100).default(0),
  notas: z.string().max(200_000).default(''),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
// Na edição todos os campos são opcionais (e sem defaults, para não sobrescrever o que não veio)
const updateSchema = z.object({
  titulo: estudoSchema.shape.titulo.optional(),
  resumo: z.string().trim().max(500).optional(),
  trilha_id: z.number().int().positive().nullable().optional(),
  status: z.enum(STATUS).optional(),
  progresso: z.number().int().min(0).max(100).optional(),
  notas: z.string().max(200_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });
const filtros = z.object({
  trilha: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS).optional(),
  q: z.string().trim().max(100).optional(),
});

const SELECT = `
  SELECT e.id, e.trilha_id, e.titulo, e.resumo, e.status, e.progresso, e.tags, e.ordem,
         e.criado_em, e.atualizado_em, e.concluido_em,
         t.nome AS trilha_nome, t.cor AS trilha_cor,
         (SELECT count(*)::int FROM aulas a WHERE a.estudo_id = e.id) AS total_aulas,
         (SELECT count(*)::int FROM aulas a WHERE a.estudo_id = e.id AND a.concluida) AS aulas_feitas`;

export async function estudosRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/estudos', async (request) => {
    const f = filtros.parse(request.query);
    const where: string[] = [];
    const params: unknown[] = [];
    if (f.trilha) {
      params.push(f.trilha);
      where.push(`e.trilha_id = $${params.length}`);
    }
    if (f.status) {
      params.push(f.status);
      where.push(`e.status = $${params.length}`);
    }
    if (f.q) {
      params.push(`%${f.q}%`);
      const p = `$${params.length}`;
      where.push(`(e.titulo ILIKE ${p} OR e.resumo ILIKE ${p} OR e.notas ILIKE ${p}
                   OR array_to_string(e.tags, ' ') ILIKE ${p})`);
    }
    const { rows } = await pool.query(`${SELECT}, length(e.notas) > 0 AS tem_notas
      FROM estudos e LEFT JOIN trilhas t ON t.id = e.trilha_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.atualizado_em DESC`, params);
    return rows;
  });

  app.get('/api/estudos/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rows } = await pool.query(`${SELECT}, e.notas
      FROM estudos e LEFT JOIN trilhas t ON t.id = e.trilha_id WHERE e.id = $1`, [id]);
    if (!rows[0]) return reply.code(404).send({ erro: 'Estudo não encontrado' });
    const aulas = await pool.query(
      'SELECT id, titulo, concluida, concluida_em, ordem FROM aulas WHERE estudo_id = $1 ORDER BY ordem, id', [id]);
    return { ...rows[0], aulas: aulas.rows };
  });

  app.post('/api/estudos', async (request, reply) => {
    const e = estudoSchema.parse(request.body);
    if (e.status === 'concluido') e.progresso = 100;
    // Novo estudo entra no fim do checklist da trilha
    const { rows } = await pool.query(
      `INSERT INTO estudos (titulo, resumo, trilha_id, status, progresso, notas, tags, concluido_em, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $4 = 'concluido' THEN now() END,
               (SELECT coalesce(max(ordem), 0) + 1 FROM estudos WHERE trilha_id IS NOT DISTINCT FROM $3))
       RETURNING id`,
      [e.titulo, e.resumo, e.trilha_id, e.status, e.progresso, e.notas, e.tags]);
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/estudos/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const e = updateSchema.parse(request.body);
    if (e.status === 'concluido') e.progresso = 100; // concluído implica 100%

    const campos = Object.entries(e).filter(([, v]) => v !== undefined);
    if (campos.length === 0) return reply.code(400).send({ erro: 'Nada para atualizar' });

    // Nomes de coluna vêm do schema (lista fixa), nunca do usuário
    const sets = campos.map(([coluna], i) => `${coluna} = $${i + 1}`);
    const params: unknown[] = campos.map(([, valor]) => valor);
    if (e.status) {
      // Mantém a data original se já estava concluído; limpa se deixou de estar
      params.push(e.status);
      sets.push(`concluido_em = CASE WHEN $${params.length} = 'concluido'
                 THEN coalesce(concluido_em, now()) END`);
    }
    if (e.trilha_id !== undefined) {
      // Mudou de trilha: vai para o fim do checklist da trilha nova
      params.push(e.trilha_id);
      const p = `$${params.length}`;
      sets.push(`ordem = CASE WHEN trilha_id IS NOT DISTINCT FROM ${p} THEN ordem
                 ELSE (SELECT coalesce(max(ordem), 0) + 1 FROM estudos WHERE trilha_id IS NOT DISTINCT FROM ${p}) END`);
    }
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE estudos SET ${sets.join(', ')}, atualizado_em = now()
       WHERE id = $${params.length} RETURNING id`, params);
    return rows[0] ?? reply.code(404).send({ erro: 'Estudo não encontrado' });
  });

  app.delete('/api/estudos/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { rowCount } = await pool.query('DELETE FROM estudos WHERE id = $1', [id]);
    return rowCount ? { ok: true } : reply.code(404).send({ erro: 'Estudo não encontrado' });
  });
}
