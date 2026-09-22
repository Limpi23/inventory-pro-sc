#!/usr/bin/env node
// Aplica las migraciones pendientes a las bases de los clientes.
//
// Sustituye a la auto-migración que hacía la app al arrancar: para ejecutarlas
// desde la app, execute_migration tenía que estar abierta a la anon key, que va
// dentro del instalador. Ahora solo la invoca service_role, y este script la
// obtiene de la sesión de la CLI de Supabase (npx supabase login).
//
// Por cada proyecto: detecta qué falta, respalda todas las tablas en
// ~/Desktop/backup-<proyecto>-<fecha>/ y aplica lo pendiente en orden,
// verificando cada paso. Si una migración falla, no sigue con las siguientes
// de ese proyecto.
//
// Uso:
//   node scripts/migrate-clients.mjs                 # todos los proyectos
//   node scripts/migrate-clients.mjs <project-ref>   # solo uno
//   DRY=1 node scripts/migrate-clients.mjs           # solo mostrar lo pendiente
//
// Al añadir una migración nueva, agrégala a MIGRACIONES con su sonda, y
// también a checkRequiredSchema() en src/renderer/lib/migrationService.ts
// si la app depende de ella.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.env.DRY === '1';
const HOY = new Date().toISOString().slice(0, 10);

// Bases de clientes con el esquema del inventario. motoland-app no está a
// propósito: es otra aplicación (solo tiene la tabla user_mappings).
const PROYECTOS = [
  ['ykkgereayqmgwezwbbgy', 'inventory-matias'],
  ['nwsnxceydflfkrylyzud', 'inventory-r-motors'],
  ['qnyqiplhxjyrbdqrjoty', 'inventory-xtress'],
  ['ovtbmbkasdjtjoneyubk', 'inventory-servicesandtools'],
];

// Orden cronológico. La sonda responde true si la migración ya está aplicada.
const MIGRACIONES = [
  { name: '20251207000000_inventory_direct_adjustment', probe: (c) => c.table('inventory_adjustments') },
  { name: '20260710000000_matriz_sucursales', probe: (c) => c.table('stock_transfers') },
  { name: '20260805000000_product_codes', probe: (c) => c.column('products', 'barcode_type') },
  { name: '20260806000000_product_prices', probe: (c) => c.table('product_prices') },
  { name: '20260922000000_lock_execute_migration', probe: (c) => c.executeMigrationCerrada() },
];

const keysDe = (ref) => {
  const out = execSync(`npx supabase projects api-keys --project-ref ${ref} 2>/dev/null`, { cwd: ROOT }).toString();
  const keys = {};
  for (const line of out.split('\n')) {
    const f = line.trim().split(/\s+/);
    if (f[1] === '|' && f[2]) keys[f[0]] = f[2];
  }
  if (!keys.service_role || !keys.anon) {
    throw new Error(`No se obtuvieron las keys de ${ref}. ¿Hiciste "npx supabase login"?`);
  }
  return keys;
};

const soloRef = process.argv[2];
const objetivo = soloRef ? PROYECTOS.filter(([ref]) => ref === soloRef) : PROYECTOS;
if (!objetivo.length) {
  console.error(`Proyecto desconocido: ${soloRef}`);
  process.exit(1);
}

let fallos = 0;

for (const [ref, nombre] of objetivo) {
  const keys = keysDe(ref);
  const URL = `https://${ref}.supabase.co/rest/v1`;
  const H = { apikey: keys.service_role, Authorization: `Bearer ${keys.service_role}`, 'Content-Type': 'application/json' };

  const rpc = async (sql) =>
    (await fetch(`${URL}/rpc/execute_migration`, { method: 'POST', headers: H, body: JSON.stringify({ migration_sql: sql }) })).json();

  const sondas = {
    table: async (t) => (await fetch(`${URL}/${t}?select=*&limit=1`, { headers: H })).ok,
    column: async (t, c) => (await fetch(`${URL}/${t}?select=${c}&limit=1`, { headers: H })).ok,
    // Cerrada = la anon key recibe permiso denegado (42501)
    executeMigrationCerrada: async () => {
      const r = await fetch(`${URL}/rpc/execute_migration`, {
        method: 'POST',
        headers: { apikey: keys.anon, Authorization: `Bearer ${keys.anon}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ migration_sql: 'SELECT 1' }),
      });
      const body = await r.json().catch(() => ({}));
      return body?.code === '42501';
    },
  };

  console.log(`\n=== ${nombre} (${ref}) ===`);
  const pendientes = [];
  for (const m of MIGRACIONES) if (!(await m.probe(sondas))) pendientes.push(m);
  console.log(`  pendientes: ${pendientes.map((m) => m.name).join(', ') || 'ninguna'}`);
  if (DRY || !pendientes.length) continue;

  // Respaldo de todas las tablas expuestas por PostgREST, paginado
  const spec = await (await fetch(`${URL}/`, { headers: H })).json();
  const tablas = Object.keys(spec.paths || {})
    .filter((p) => p !== '/' && !p.startsWith('/rpc'))
    .map((p) => p.slice(1));
  const dir = join(process.env.HOME, 'Desktop', `backup-${nombre}-${HOY}`);
  mkdirSync(dir, { recursive: true });
  let filas = 0;
  for (const t of tablas) {
    let datos = [];
    for (let off = 0; ; off += 1000) {
      const r = await fetch(`${URL}/${t}?select=*&limit=1000&offset=${off}`, { headers: H });
      if (!r.ok) break;
      const pagina = await r.json();
      datos = datos.concat(pagina);
      if (pagina.length < 1000) break;
    }
    writeFileSync(join(dir, `${t}.json`), JSON.stringify(datos));
    filas += datos.length;
  }
  console.log(`  respaldo: ${tablas.length} tablas, ${filas} filas en ${dir}`);

  for (const m of pendientes) {
    const sql = readFileSync(join(ROOT, 'supabase', 'migrations', `${m.name}.sql`), 'utf8');
    const res = await rpc(sql);
    // PostgREST no ve tablas ni columnas nuevas hasta recargar su caché
    await rpc("NOTIFY pgrst, 'reload schema'");
    await new Promise((r) => setTimeout(r, 4000));
    const ok = await m.probe(sondas);
    console.log(`  ${ok ? 'OK   ' : 'FALLA'} ${m.name}${res?.success ? '' : `  -> ${res?.error || JSON.stringify(res)}`}`);
    if (!ok) {
      fallos += 1;
      console.log('  Detenido: no se aplican las siguientes migraciones de este proyecto.');
      break;
    }
  }
}

process.exit(fallos ? 1 : 0);
