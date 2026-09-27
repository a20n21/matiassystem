import { createServer } from 'node:http';
import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

export const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });


const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3],
  registers: [registry],
});

const ignorar = new Set(['/healthz', '/readyz']); // probes só gerariam ruído

export function registerMetrics(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    
    const route = request.routeOptions.url ?? 'desconhecida';
    if (ignorar.has(route)) return;
    httpDuration.observe(
      { method: request.method, route, status_code: String(reply.statusCode) },
      reply.elapsedTime / 1000,
    );
  });
}


export function startMetricsServer(port: number) {
  const server = createServer(async (req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': registry.contentType });
    res.end(await registry.metrics());
  });
  server.listen(port, '0.0.0.0');
  return server;
}
