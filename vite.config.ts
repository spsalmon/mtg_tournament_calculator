import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves this from https://spsalmon.github.io/mtg_tournament_calculator/,
// so every asset URL needs the repo name in front of it or the deployed site 404s.
export default defineConfig({
  base: '/mtg_tournament_calculator/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
