// Aplica neon/schema.sql en la base de datos de Neon.
// Uso: npm run neon:schema
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DIRECT_DATABASE_URL en .env.local");
  const sql = fs.readFileSync(path.join(__dirname, "..", "neon", "schema.sql"), "utf8");
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Esquema aplicado en Neon.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
