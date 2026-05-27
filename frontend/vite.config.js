import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks: {
          flow: ['@xyflow/react'],
          markdown: ['react-markdown', 'remark-gfm'],
          syntax: ['react-syntax-highlighter'],
          motion: ['framer-motion']
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
