#!/usr/bin/env node
/**
 * Aplica migraciones SQL a TODAS las bases Supabase de los clientes.
 *
 * Uso:
 *   node scripts/migrate-all.cjs                        # aplica la migración de sucursales
 *   node scripts/migrate-all.cjs <archivo1.sql> [...]   # aplica archivos específicos
 *
 * Configuración: crear scripts/databases.json (NO se sube a git) con:
 *   [
 *     { "name": "Cliente A", "url": "https://xxxx.supabase.co", "key": "service_role_key" },
 *     { "name": "Cliente B", "url": "https://yyyy.supabase.co", "key": "service_role_key" }
 *   ]
 *
 * Usa la función RPC execute_migration que ya existe en cada base
 * (creada durante el bootstrap inicial de la app). Las migraciones del
 * proyecto son idempotentes: ejecutarlas dos veces no causa daño.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'databases.json');
const DEFAULT_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20260710000000_matriz_sucursales.sql');

function fail(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
}

if (!fs.existsSync(CONFIG_PATH)) {
  fail(
    `No existe ${CONFIG_PATH}.\n` +
    `  Créalo copiando scripts/databases.example.json y completando la URL y la\n` +
    `  service_role key de cada proyecto Supabase (Dashboard → Settings → API).`
  );
}

let databases;
try {
  databases = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  fail(`databases.json inválido: ${e.message}`);
}
if (!Array.isArray(databases) || databases.length === 0) {
  fail('databases.json debe ser un arreglo con al menos una base.');
}

const migrationArgs = process.argv.slice(2);
const migrationFiles = (migrationArgs.length ? migrationArgs : [DEFAULT_MIGRATION])
  .map(f => path.isAbsolute(f) ? f : path.join(ROOT, f));

for (const file of migrationFiles) {
  if (!fs.existsSync(file)) fail(`No existe el archivo de migración: ${file}`);
}

async function applyMigration(db, sql, label) {
  const url = db.url.replace(/\/+$/, '') + '/rest/v1/rpc/execute_migration';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': db.key,
      'Authorization': `Bearer ${db.key}`,
    },
    body: JSON.stringify({ migration_sql: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    // PGRST202: la función execute_migration no existe en esa base
    if (text.includes('PGRST202') || text.includes('execute_migration')) {
      throw new Error(
        `La base no tiene la función execute_migration (bootstrap pendiente). ` +
        `Ejecuta la migración manualmente en el SQL Editor de Supabase.`
      );
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let result;
  try { result = JSON.parse(text); } catch { result = null; }
  if (result && result.success === false) {
    throw new Error(result.error || 'execute_migration retornó error');
  }
  console.log(`    \x1b[32m✔\x1b[0m ${label}`);
}

(async () => {
  console.log(`Aplicando ${migrationFiles.length} migración(es) a ${databases.length} base(s)...\n`);
  let failures = 0;

  for (const db of databases) {
    console.log(`▶ ${db.name || db.url}`);
    if (!db.url || !db.key) {
      console.error(`    \x1b[31m✖ Falta url o key en la configuración\x1b[0m`);
      failures++;
      continue;
    }
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      try {
        await applyMigration(db, sql, path.basename(file));
      } catch (e) {
        console.error(`    \x1b[31m✖ ${path.basename(file)}: ${e.message}\x1b[0m`);
        failures++;
      }
    }
  }

  console.log('');
  if (failures > 0) {
    fail(`Terminado con ${failures} error(es). Revisa los mensajes anteriores.`);
  }
  console.log('\x1b[32m✔ Todas las bases quedaron migradas.\x1b[0m');
})();
