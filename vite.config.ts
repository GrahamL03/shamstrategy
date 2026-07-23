import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Prevent Vite from watching Rust build files and locking on .dll generation
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});