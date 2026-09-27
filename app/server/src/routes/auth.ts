import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSession, destroySession, isAuthenticated } from '../auth.js';
import { config } from '../config.js';
import { verifyPassword } from '../password.js';

const loginSchema = z.object({
  usuario: z.string().trim().min(1).max(100),
  senha: z.string().min(1).max(200),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', {
    // Força bruta: 5 tentativas por minuto por IP
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { usuario, senha } = loginSchema.parse(request.body);
    // Verifica a senha mesmo com usuário errado: o tempo de resposta não revela qual dos dois errou
    const senhaOk = await verifyPassword(senha, config.appPasswordHash);
    if (usuario !== config.appUser || !senhaOk) {
      request.log.warn({ usuario }, 'login recusado');
      return reply.code(401).send({ erro: 'Usuário ou senha inválidos' });
    }
    await createSession(reply);
    return { usuario: config.appUser };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await destroySession(request, reply);
    return { ok: true };
  });

  app.get('/api/auth/sessao', async (request) => {
    const autenticado = await isAuthenticated(request);
    return { autenticado, usuario: autenticado ? config.appUser : null };
  });
}
