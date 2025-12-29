import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // esbuild is the default minifier in Vite 6, 
    // it's faster and handles type-safe 'drop' options better.
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    port: 3000,
  },
});
