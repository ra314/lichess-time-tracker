import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './', // Relative paths for easier deployment
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
