import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true binds the dev server to 0.0.0.0 instead of localhost, so other
// devices on the same Wi-Fi (your phone, a tablet) can open it. Vite prints
// the resulting Network URL on startup.
//
// The /api proxy is what makes that actually work: with VITE_API_BASE unset,
// the frontend calls /api/... on its own origin and Vite forwards it to the
// backend. Without it the phone would resolve "localhost:8000" to itself and
// every request would fail — and pointing it at a hardcoded LAN IP would mean
// re-editing .env every time the router hands out a different address, plus
// adding that origin to the backend's CORS list. Same-origin sidesteps both.
const backend = process.env.BACKEND_URL || 'http://localhost:8000'

const proxy = {
  '/api': {
    target: backend,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy },
  preview: { host: true, proxy },
})
