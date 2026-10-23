import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same origin as the API: the browser only sees localhost:5173 (docs/design/frontend-skeleton.md).
    // 8080 is the APP_PORT default in docker-compose.yml.
    proxy: { '/api': 'http://localhost:8080' },
  },
})
