import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Quando o back-end estiver rodando, o Vite repassa as chamadas /api para ele.
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
})
