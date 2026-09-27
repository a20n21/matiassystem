import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { pool } from './db.js';

export const SESSION_COOKIE = 'ms_session';

// No banco fica só o hash do token: um vazamento do banco não entrega sessões válidas
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(reply: FastifyReply): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600_000);
  await pool.query('DELETE FROM sessoes WHERE expira_em < now()');
  await pool.query('INSERT INTO sessoes (id, expira_em) VALUES ($1, $2)', [hashToken(token), expiresAt]);
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,          // JavaScript não lê o cookie
    sameSite: 'strict',      // não é enviado em requisições vindas de outros sites
    secure: config.cookieSecure,
    expires: expiresAt,
  });
}

export async function destroySession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await pool.query('DELETE FROM sessoes WHERE id = $1', [hashToken(token)]);
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function isAuthenticated(request: FastifyRequest): Promise<boolean> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return false;
  const { rowCount } = await pool.query(
    'SELECT 1 FROM sessoes WHERE id = $1 AND expira_em > now()', [hashToken(token)]);
  return rowCount === 1;
}

/** preHandler das rotas protegidas */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await isAuthenticated(request))) {
    await reply.code(401).send({ erro: 'Não autenticado' });
  }
}
