import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';
  
  return {
    plugins: [
      react(),
      isElectron && electron({
        entry: 'electron.cjs',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, './src/renderer'),
        '@components': resolve(__dirname, './src/renderer/components'),
        '@views': resolve(__dirname, './src/renderer/views'),
        '@assets': resolve(__dirname, './src/renderer/assets'),
        '@hooks': resolve(__dirname, './src/renderer/hooks'),
        '@lib': resolve(__dirname, './src/renderer/lib'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          preload: resolve(__dirname, 'src/main/preload.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'preload') {
              return 'preload.js';
            }
            return 'assets/[name].js';
          },
          manualChunks: undefined
        }
      }
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      // Ensure we do not transform stray JS sources under src; TS/TSX are canonical
      // We keep default loaders; explicit exclusion handled in optimizeDeps
    },
    optimizeDeps: {
      esbuildOptions: {
        tsconfigRaw: {
          compilerOptions: {
            skipLibCheck: true,
            noImplicitAny: false,
            alwaysStrict: true,
            strict: false,
            target: 'ES2020',
            module: 'commonjs',
            jsx: 'react',
          }
        }
      },
      exclude: [
        // Exclude any JS files in src; TS is the source of truth
        'src/**/**/*.js'
      ]
    },
    base: './',
    server: {
      port: 3000,
      host: true
    }
  };
}); 