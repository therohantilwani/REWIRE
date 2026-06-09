import { defineConfig } from 'vite';

export default defineConfig({
  // Automatically use '/Rewire/' as the base path when deploying via GitHub Actions,
  // otherwise default to '/' for local development.
  base: process.env.GITHUB_ACTIONS ? '/REWIRE/' : '/',
});
