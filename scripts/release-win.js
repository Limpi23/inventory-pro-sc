#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  console.log(`\n==== ${cmd} ====`);
  execSync(cmd, { stdio: 'inherit', windowsHide: true });
}

function killApp() {
  const names = ['"Inventario Pro.exe"', '"Inventario Pro"'];
  for (const n of names) {
    try { execSync(`taskkill /IM ${n} /F`, { stdio: 'ignore' }); console.log('Terminada', n); } catch { /* ignore */ }
  }
}

function cleanOut() {
  const outDir = path.join(process.cwd(), 'out');
  if (fs.existsSync(outDir)) {
    console.log('Eliminando out/...');
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) { console.warn('No se pudo borrar out:', e.message); }
  }
}

function copyInstaller() {
  const dir = path.join('out', 'make', 'squirrel.windows', 'x64');
  if (!fs.existsSync(dir)) return;
  const setups = fs.readdirSync(dir).filter(f => /Setup.*\.exe$/i.test(f));
  if (!setups.length) return;
  setups.sort((a,b)=> fs.statSync(path.join(dir,b)).mtimeMs - fs.statSync(path.join(dir,a)).mtimeMs);
  const releaseDir = path.join('release');
  if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
  const src = path.join(dir, setups[0]);
  const dest = path.join(releaseDir, setups[0]);
  fs.copyFileSync(src, dest);
  console.log('Instalador copiado a release/', setups[0]);
}

function main() {
  console.log('== Release Windows (script orquestador) ==');
  process.env.NODE_ENV = 'production';
  killApp();
  cleanOut();
  run('npm run build:preload');
  run('npm run build');
  run('npx cross-env NODE_ENV=production electron-forge make');
  copyInstaller();
  console.log('\n✅ Listo');
}

main();
