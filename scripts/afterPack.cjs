/**
 * Script ejecutado después de empaquetar la aplicación con Electron Builder
 * Se utiliza para realizar tareas adicionales antes de crear el instalador
 */

const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const appName = packager.appInfo.productFilename;
  
  console.log(`Ejecutando afterPack para ${appName} en ${electronPlatformName}`);
  
  // Tarea: Verificar y crear archivos necesarios para la instalación
  try {
    if (electronPlatformName === 'win32') {
      // Verificar si existen las imágenes para el instalador
      const installerAssets = [
        { 
          name: 'installer-header.bmp', 
          source: path.join(__dirname, '../src/assets/installer-header.bmp'),
          dest: path.join(__dirname, '../src/assets/installer-header.bmp')
        },
        { 
          name: 'installer-sidebar.bmp', 
          source: path.join(__dirname, '../src/assets/installer-sidebar.bmp'),
          dest: path.join(__dirname, '../src/assets/installer-sidebar.bmp')
        },
        {
          name: 'splash.bmp',
          source: path.join(__dirname, '../src/assets/splash.bmp'),
          dest: path.join(__dirname, '../src/assets/splash.bmp')
        }
      ];
      
      // Verificar si existen los archivos necesarios
      installerAssets.forEach(asset => {
        if (!fs.existsSync(asset.source)) {
          console.warn(`Advertencia: No se encontró ${asset.name} para el instalador.`);
        }
      });
    }
    
    console.log('afterPack completado con éxito');
  } catch (error) {
    console.error('Error en afterPack:', error);
    throw error;
  }
}; 