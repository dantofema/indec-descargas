import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { shellPlugin } from './scripts/shell.mjs'

export default defineConfig({
  base: '/indec-descargas/',
  plugins: [shellPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        notas: resolve(import.meta.dirname, 'notas/index.html'),
        servicios: resolve(import.meta.dirname, 'servicios/index.html'),
      },
    },
  },
})
