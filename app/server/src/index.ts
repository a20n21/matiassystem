import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate, pool, waitForDatabase } from './db.js';

await waitForDatabase();
await migrate();

const app = await buildApp();
await app.listen({ host: config.host, port: config.port });
app.log.info(`matiassystem ${config.version} ouvindo na porta ${config.port}`);

// Kubernetes envia SIGTERM ao trocar o pod: termina as requisições em andamento antes de sair
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} recebido, encerrando`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
