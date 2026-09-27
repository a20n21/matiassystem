import { fileURLToPath } from 'node:url';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 8080),
  isProd: process.env.NODE_ENV === 'production',
  version: process.env.VERSION ?? 'local',
  // Único usuário do app. A senha nunca fica em texto: só o hash (npm run hash-password).
  appUser: required('APP_USER'),
  appPasswordHash: required('APP_PASSWORD_HASH'),
  // true atrás de HTTPS. Local (http://*.localhost) precisa ser false.
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  // Fuso para "hoje" e "esta semana" (o banco trabalha em UTC)
  timezone: process.env.APP_TIMEZONE ?? 'America/Sao_Paulo',
  // Build do frontend (Vite). Ausente no modo dev: quem serve o front é o Vite.
  publicDir: process.env.PUBLIC_DIR ?? fileURLToPath(new URL('../public', import.meta.url)),
  migrationsDir: fileURLToPath(new URL('../migrations', import.meta.url)),
};
