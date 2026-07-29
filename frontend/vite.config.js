import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/product-search-github/',
  build: {
    sourcemap: true,
    target: 'es2020'
  }
});

