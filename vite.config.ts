import { defineConfig } from 'vite'

export default defineConfig({
  // ... your existing config
  server: {
    port: 5173, // make sure your port matches tauri.conf.json
    watch: {
      // Tell Vite to ignore watching the Rust target directory
      ignored: ['**/src-tauri/**'],
    },
  },
})