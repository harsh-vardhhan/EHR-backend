import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react({
      // @ts-expect-error: reactCompiler is a new option in @vitejs/plugin-react v4.3.0+ but types might not be updated
      reactCompiler: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
