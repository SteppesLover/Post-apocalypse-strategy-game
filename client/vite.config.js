import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sessions': 'http://localhost:3000',
      '/me': 'http://localhost:3000',
      '/secretWord': 'http://localhost:3000'
    }
  }
});
