const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'src/assets/app-icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-wix',
      config: {
        language: 3082,
        description: 'Inventario Pro',
        manufacturer: 'SuitCore',
        exe: 'inventory-suit.exe',
        name: 'inventory-suit',
        ui: {
          chooseDirectory: true,
        },
        wixOptions: {
          codepage: 65001,
          language: 3082,
          manufacturer: 'SuitCore',
          productName: 'Inventario Pro',
          productVersion: '1.0.0',
          upgradeCode: '12345678-1234-1234-1234-123456789012',
          features: {
            autoUpdate: true,
            autoLaunch: true
          },
          extensions: ['WixUtilExtension'],
          cultures: ['es-ES'],
          wixToolsetPath: process.env.WIX || undefined,
          wixToolsetVersion: '3.14',
          wixToolsetArchitecture: 'x64',
          wixToolsetOptions: {
            codepage: 65001,
            language: 3082,
            cultures: ['es-ES']
          },
          localizationFile: './wix-localization.wxl'
        }
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
