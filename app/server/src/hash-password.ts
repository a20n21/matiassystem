// Gera o hash para APP_PASSWORD_HASH.
//   Pela entrada padrão (a senha não aparece na lista de processos nem no histórico):
//     echo -n 'minha senha' | node dist/hash-password.js
//   Ou como argumento (só para testes locais):
//     npm run hash-password -- 'minha senha'
import { hashPassword } from './password.js';

async function lerEntrada(): Promise<string> {
  let dados = '';
  for await (const parte of process.stdin) dados += parte;
  // O PowerShell pode enviar um BOM (U+FEFF) invisível no início: não faz parte da senha
  return dados.replace(/^﻿/, '').replace(/\r?\n$/, '');
}

const password = process.argv[2] ?? (process.stdin.isTTY ? '' : await lerEntrada());
if (!password) {
  console.error("Uso: echo -n 'sua senha' | node dist/hash-password.js");
  process.exit(1);
}
console.log(await hashPassword(password));
