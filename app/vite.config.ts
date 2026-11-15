import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // allow Cloudflare quick-tunnel hostnames (for Quest/WebXR testing over HTTPS)
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // NASA PSI API only allows its own origin (CORS) — proxy it so Explore can
      // resolve file download links and preview text files from the browser.
      '/psi-api': {
        target: 'https://psi.nasa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/psi-api/, '/geode-py/ws'),
        timeout: 20_000,
        proxyTimeout: 20_000,
      },
    },
  },
})
