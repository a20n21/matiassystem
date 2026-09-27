import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

// Cópia de segurança completa. O cluster é local: apagar o cluster apaga o banco.
const backupSchema = z.object({
  versao: z.literal(1),
  trilhas: z.array(z.object({
    id: z.number().int(),
    nome: z.string(),
    descricao: z.string(),
    cor: z.string(),
    ordem: z.number().int(),
    criado_em: z.string(),
  })),
  estudos: z.array(z.object({
    id: z.number().int(),
    trilha_id: z.number().int().nullable(),
    titulo: z.string(),
    resumo: z.string(),
    status: z.enum(['planejado', 'estudando', 'concluido']),
    progresso: z.number().int().min(0).max(100),
    notas: z.string(),
    tags: z.array(z.string()),
    ordem: z.number().int().default(0), // backups antigos não têm ordem
    criado_em: z.string(),
    atualizado_em: z.string(),
    concluido_em: z.string().nullable(),
  })),
  // Backups de antes das aulas não têm este campo
  aulas: z.array(z.object({
    id: z.number().int(),
    estudo_id: z.number().int(),
    titulo: z.string(),
    concluida: z.boolean(),
    concluida_em: z.string().nullable(),
    ordem: z.number().int(),
    criado_em: z.string(),
  })).default([]),
  sessoes: z.array(z.object({
    id: z.number().int(),
    estudo_id: z.number().int(),
    aula_id: z.number().int().nullable(),
    inicio: z.string(),
    fim: z.string().nullable(),
  })).default([]),
  roadmap: z.array(z.object({
    id: z.number().int(),
    trilha_id: z.number().int().nullable(),
    titulo: z.string(),
    descricao: z.string(),
    status: z.enum(['proximo', 'andamento', 'feito']),
    periodo: z.string(),
    ordem: z.number().int(),
    criado_em: z.string(),
    atualizado_em: z.string(),
  })),
});

export async function dadosRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/dados/exportar', async (_request, reply) => {
    const [trilhas, estudos, aulas, sessoes, roadmap] = await Promise.all([
      pool.query('SELECT * FROM trilhas ORDER BY id'),
      pool.query('SELECT * FROM estudos ORDER BY id'),
      pool.query('SELECT * FROM aulas ORDER BY id'),
      pool.query('SELECT * FROM sessoes_estudo ORDER BY id'),
      pool.query('SELECT * FROM roadmap_itens ORDER BY id'),
    ]);
    const data = new Date().toISOString().slice(0, 10);
    reply.header('Content-Disposition', `attachment; filename="matiassystem-${data}.json"`);
    return {
      versao: 1,
      exportado_em: new Date().toISOString(),
      trilhas: trilhas.rows,
      estudos: estudos.rows,
      aulas: aulas.rows,
      sessoes: sessoes.rows,
      roadmap: roadmap.rows,
    };
  });

  /** Substitui TODOS os dados pelos do arquivo, numa transação (tudo ou nada) */
  app.post('/api/dados/importar', async (request) => {
    const b = backupSchema.parse(request.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE sessoes_estudo, aulas, estudos, roadmap_itens, trilhas RESTART IDENTITY');
      for (const t of b.trilhas) {
        await client.query(
          'INSERT INTO trilhas (id, nome, descricao, cor, ordem, criado_em) VALUES ($1,$2,$3,$4,$5,$6)',
          [t.id, t.nome, t.descricao, t.cor, t.ordem, t.criado_em]);
      }
      for (const e of b.estudos) {
        await client.query(
          `INSERT INTO estudos (id, trilha_id, titulo, resumo, status, progresso, notas, tags, ordem,
                                criado_em, atualizado_em, concluido_em)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [e.id, e.trilha_id, e.titulo, e.resumo, e.status, e.progresso, e.notas, e.tags, e.ordem,
           e.criado_em, e.atualizado_em, e.concluido_em]);
      }
      for (const a of b.aulas) {
        await client.query(
          `INSERT INTO aulas (id, estudo_id, titulo, concluida, concluida_em, ordem, criado_em)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [a.id, a.estudo_id, a.titulo, a.concluida, a.concluida_em, a.ordem, a.criado_em]);
      }
      for (const s of b.sessoes) {
        await client.query(
          'INSERT INTO sessoes_estudo (id, estudo_id, aula_id, inicio, fim) VALUES ($1,$2,$3,$4,$5)',
          [s.id, s.estudo_id, s.aula_id, s.inicio, s.fim]);
      }
      for (const r of b.roadmap) {
        await client.query(
          `INSERT INTO roadmap_itens (id, trilha_id, titulo, descricao, status, periodo, ordem,
                                      criado_em, atualizado_em)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [r.id, r.trilha_id, r.titulo, r.descricao, r.status, r.periodo, r.ordem,
           r.criado_em, r.atualizado_em]);
      }
      // Ids vieram do arquivo: as sequências continuam depois do maior id
      for (const tabela of ['trilhas', 'estudos', 'aulas', 'sessoes_estudo', 'roadmap_itens']) {
        await client.query(`SELECT setval(pg_get_serial_sequence('${tabela}', 'id'),
                            coalesce((SELECT max(id) FROM ${tabela}), 0) + 1, false)`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return {
      trilhas: b.trilhas.length, estudos: b.estudos.length, aulas: b.aulas.length,
      sessoes: b.sessoes.length, roadmap: b.roadmap.length,
    };
  });
}
