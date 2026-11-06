/**
 * Arranca `next dev` cargando .env.dev en vez de .env.local (develop).
 *
 * No se puede usar `node --env-file=.env.dev next dev` porque Next reenvía
 * los flags de Node a un proceso hijo vía NODE_OPTIONS, y Node rechaza
 * --env-file ahí. Por eso las variables se cargan aquí y se heredan.
 * Next no pisa las variables que ya existen en process.env, así que
 * .env.dev gana sobre .env.local.
 */
const { spawn } = require("node:child_process");

process.loadEnvFile(".env.dev");

const hijo = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)],
  { stdio: "inherit" }
);

hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => hijo.kill(senal));
}
