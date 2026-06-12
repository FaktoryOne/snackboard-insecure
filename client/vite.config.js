import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development the web client runs on :5173 and proxies API calls to the
// Express server on :3000, so the browser sees a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
