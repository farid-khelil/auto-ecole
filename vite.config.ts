import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    allowedHosts: ['consultation-reducing-medical-preparation.trycloudflare.com',
      'triceps-revivable-greedy.ngrok-free.dev'
    ],
  },
});
