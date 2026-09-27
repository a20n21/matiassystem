import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';
import { aulasRoutes } from './routes/aulas.js';
import { authRoutes } from './routes/auth.js';
import { dadosRoutes } from './routes/dados.js';
import { estudosRoutes } from './routes/estudos.js';
import { painelRoutes } from './routes/painel.js';
import { roadmapRoutes } from './routes/roadmap.js';
import { sessoesRoutes } from './routes/sessoes.js';
import { trilhasRoutes } from './routes/trilhas.js';
import { registerSecurity } from './security.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.isProd ? 'info' : 'debug' },
    trustProxy: true,          // atrás do Traefik: IP real do cliente (rate limit do login)
    bodyLimit: 10 * 1024 * 1024, // importação de backup
  });

  registerSecurity(app);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        erro: 'Dados inválidos',
        detalhes: error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`),
      });
    }
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') return reply.code(409).send({ erro: 'Já existe um registro com esse nome' });
    if (pgCode === '23503') return reply.code(400).send({ erro: 'Referência inexistente (trilha, estudo ou aula)' });
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    const message = error instanceof Error ? error.message : 'Erro';
    return reply.code(status).send({ erro: status >= 500 ? 'Erro interno' : message });
  });

  // Probes do Kubernetes: liveness não depende do banco; readiness sim
  app.get('/healthz', async () => 'ok');
  app.get('/readyz', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return 'ok';
    } catch {
      return reply.code(503).send('banco indisponível');
    }
  });

  await app.register(authRoutes);
  await app.register(trilhasRoutes);
  await app.register(estudosRoutes);
  await app.register(aulasRoutes);
  await app.register(sessoesRoutes);
  await app.register(roadmapRoutes);
  await app.register(painelRoutes);
  await app.register(dadosRoutes);

  // Frontend compilado (só na imagem). Rotas desconhecidas fora de /api caem no index.html (SPA).
  const hasFrontend = existsSync(config.publicDir);
  if (hasFrontend) {
    await app.register(fastifyStatic, { root: config.publicDir, wildcard: false });
  }
  app.setNotFoundHandler(async (request, reply) => {
    if (hasFrontend && request.method === 'GET' && !request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ erro: 'Não encontrado' });
  });

  return app;
}
