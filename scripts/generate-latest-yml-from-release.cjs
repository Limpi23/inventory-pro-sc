#!/usr/bin/env node

/**
 * Script para generar latest.yml desde un release existente en GitHub
 * Útil para agregar soporte de electron-updater a releases ya publicados
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OWNER = 'Limpi23';
const REPO = 'inventory-pro-sc';
const TAG = process.argv[2] || 'v1.7.1';

console.log(`\n🔍 Buscando release ${TAG} en ${OWNER}/${REPO}...\n`);

// Obtener información del release desde GitHub API
https.get({
  hostname: 'api.github.com',
  path: `/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
  headers: {
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github.v3+json'
  }
}, (res) => {
  let data = '';
  
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`❌ Error: No se pudo obtener el release (HTTP ${res.statusCode})`);
      console.error(data);
      process.exit(1);
    }

    const release = JSON.parse(data);
    const nupkgAsset = release.assets.find(a => a.name.endsWith('-full.nupkg'));
    
    if (!nupkgAsset) {
      console.error('❌ Error: No se encontró archivo .nupkg en el release');
      process.exit(1);
    }

    console.log(`✅ Encontrado: ${nupkgAsset.name}`);
    console.log(`   Tamaño: ${(nupkgAsset.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   URL: ${nupkgAsset.browser_download_url}\n`);

    // Descargar el archivo .nupkg
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const tempFile = path.join(tempDir, nupkgAsset.name);
    const file = fs.createWriteStream(tempFile);
    
    console.log('📥 Descargando archivo .nupkg...');
    
    https.get(nupkgAsset.browser_download_url, (dlRes) => {
      dlRes.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log('✅ Descarga completada\n');
          
          // Calcular SHA512
          console.log('🔐 Calculando SHA512...');
          const fileBuffer = fs.readFileSync(tempFile);
          const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('base64');
          
          // Generar latest.yml
          const version = TAG.replace(/^v/, '');
          const latestYml = `version: ${version}
files:
  - url: ${nupkgAsset.name}
    sha512: ${sha512}
    size: ${nupkgAsset.size}
path: ${nupkgAsset.name}
sha512: ${sha512}
releaseDate: ${release.published_at}
`;

          // Guardar latest.yml
          const outputPath = path.join(tempDir, 'latest.yml');
          fs.writeFileSync(outputPath, latestYml, 'utf8');
          
          console.log('✅ Archivo latest.yml generado exitosamente');
          console.log(`   Ubicación: ${outputPath}`);
          console.log(`   Versión: ${version}`);
          console.log(`   SHA512: ${sha512.substring(0, 32)}...\n`);
          
          console.log('📤 Próximo paso:');
          console.log(`   Sube el archivo temp/latest.yml al release ${TAG}:`);
          console.log(`   gh release upload ${TAG} temp/latest.yml --clobber\n`);
          
          // Limpiar archivo temporal .nupkg (mantener latest.yml)
          fs.unlinkSync(tempFile);
        });
      });
    }).on('error', (err) => {
      fs.unlinkSync(tempFile);
      console.error('❌ Error descargando archivo:', err.message);
      process.exit(1);
    });
  });
}).on('error', (err) => {
  console.error('❌ Error conectando a GitHub API:', err.message);
  process.exit(1);
});
