#!/usr/bin/env node

/**
 * Script para generar latest.yml para electron-updater desde un release de Squirrel.Windows
 * Este archivo permite que electron-updater funcione con releases generados por Electron Forge
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lee el package.json para obtener la versión
const packageJson = require('../package.json');
const version = packageJson.version;

// Encuentra el archivo .nupkg en out/make/squirrel.windows/x64/
const makeDir = path.join(__dirname, '..', 'out', 'make', 'squirrel.windows', 'x64');

if (!fs.existsSync(makeDir)) {
  console.error('❌ Error: No se encontró la carpeta de build de Squirrel');
  console.error(`   Esperado: ${makeDir}`);
  console.error('   Ejecuta primero: npm run make');
  process.exit(1);
}

const files = fs.readdirSync(makeDir);
const nupkgFile = files.find(f => f.endsWith('-full.nupkg'));
const setupFile = files.find(f => f.includes('Setup') && f.endsWith('.exe'));

if (!nupkgFile) {
  console.error('❌ Error: No se encontró archivo .nupkg en', makeDir);
  process.exit(1);
}

const nupkgPath = path.join(makeDir, nupkgFile);
const setupPath = setupFile ? path.join(makeDir, setupFile) : null;

// Calcula el SHA512 del archivo .nupkg
const fileBuffer = fs.readFileSync(nupkgPath);
const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('base64');

// Obtiene el tamaño del archivo
const size = fs.statSync(nupkgPath).size;

// Genera el contenido de latest.yml
const latestYml = `version: ${version}
files:
  - url: ${nupkgFile}
    sha512: ${sha512}
    size: ${size}
path: ${nupkgFile}
sha512: ${sha512}
releaseDate: ${new Date().toISOString()}
`;

// Guarda latest.yml en la misma carpeta
const outputPath = path.join(makeDir, 'latest.yml');
fs.writeFileSync(outputPath, latestYml, 'utf8');

console.log('✅ Archivo latest.yml generado exitosamente');
console.log(`   Ubicación: ${outputPath}`);
console.log(`   Versión: ${version}`);
console.log(`   Archivo: ${nupkgFile}`);
console.log(`   SHA512: ${sha512.substring(0, 32)}...`);
console.log(`   Tamaño: ${(size / 1024 / 1024).toFixed(2)} MB`);

// Muestra instrucciones para subir a GitHub
console.log('\n📦 Para publicar en GitHub Release:');
console.log(`   1. Sube este archivo junto con ${nupkgFile} y RELEASES`);
console.log(`   2. Asegúrate de que todos estén en el mismo release (tag v${version})`);
console.log(`   3. El auto-updater ahora podrá detectar actualizaciones correctamente`);
