import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development the web client runs on :5173 and proxies API calls to the
// Express server on :3000, so the browser sees a single origin.
//
// The API reads the same PORT variable (src/index.js), so `PORT=3001 npm run dev`
// moves both ends together. A hardcoded 3000 here would leave the proxy pointing
// at nothing: the page would load and every API call would fail.
const API_PORT = process.env.PORT ?? 3000

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
    },
  },
})
