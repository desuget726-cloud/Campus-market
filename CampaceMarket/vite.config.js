import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiUrl = (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'replace-legacy-api-origin',
        transform(source, id) {
          if (!/\.(js|jsx)$/.test(id) || !id.includes('/src/')) return null
          const transformed = source.replaceAll('http://127.0.0.1:8000', apiUrl)
            .replaceAll('http://localhost:8000', apiUrl)
          return transformed === source ? null : { code: transformed, map: null }
        },
      },
    ],
  }
})
