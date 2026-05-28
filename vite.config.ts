/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/social-cricket-scorer/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'CricPad',
        short_name: 'CricPad',
        description: 'CricPad — live cricket scoring, stats & leaderboards for any match',
        theme_color: '#16a34a',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/social-cricket-scorer/',
        scope: '/social-cricket-scorer/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
