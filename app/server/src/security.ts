import type { FastifyInstance } from 'fastify';

// Mesmos headers que o ZAP exige na hml (k8s/overlays/hml/zap/rules.tsv)
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function registerSecurity(app: FastifyInstance): void {
  // Só JSON: sem o parser de text/plain, um formulário de outro site não consegue postar na API
  app.removeContentTypeParser('text/plain');

  // Requisições que alteram dados precisam vir do próprio site (defesa extra ao SameSite=Strict)
  app.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      // "Origin: null" (iframes sandbox, redirecionamentos): tratado como estranho
    }
    if (host !== request.headers.host) {
      await reply.code(403).send({ erro: 'Origem não permitida' });
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) reply.header(name, value);
    const url = request.url;
    if (url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');            // dados pessoais: nunca em cache
    } else if (url.startsWith('/assets/')) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable'); // nome com hash do Vite
    } else {
      reply.header('Cache-Control', 'no-cache');
    }
    return payload;
  });
}
