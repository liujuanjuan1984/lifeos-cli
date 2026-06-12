import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import { configDefaults } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function createCspContent(mode: string, env: Record<string, string>) {
  if (mode === 'development') {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: http: https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  }

  const connectSources = new Set(["'self'"])
  const apiOrigin = normalizeOrigin(env.VITE_API_BASE_URL)
  if (apiOrigin) connectSources.add(apiOrigin)

  const extraConnectSources = (env.VITE_CSP_CONNECT_SRC ?? '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)

  for (const value of extraConnectSources) {
    connectSources.add(value)
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSources).join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

function contentSecurityPolicyPlugin(cspContent: string): PluginOption {
  return {
    name: 'content-security-policy-meta',
    transformIndexHtml(html) {
      return html.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        [
          '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          `<meta http-equiv="Content-Security-Policy" content="${cspContent}" />`,
        ].join('\n    '),
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cspContent = createCspContent(mode, env)

  return {
    plugins: [
      react(),
      TanStackRouterVite({
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
        quoteStyle: 'single',
      }),
      contentSecurityPolicyPlugin(cspContent),
    ],
    base: '/',
    server: {
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8765',
          changeOrigin: true,
          secure: false,
          ws: true, // 支持 WebSocket
        },
      },
    },
    optimizeDeps: {
      force: true,
      include: [
        '@fullcalendar/core',
        '@fullcalendar/react',
        '@fullcalendar/timegrid',
        '@fullcalendar/interaction',
        '@fullcalendar/luxon3',
        '@tanstack/react-router',
        '@tanstack/react-query',
        'react',
        'react-dom',
        'three',
        '@react-three/fiber',
        'luxon',
        'i18next',
        'react-i18next',
      ],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@test': fileURLToPath(new URL('./test', import.meta.url)),
      },
    },
    build: {
      // 调整包大小警告限制
      chunkSizeWarningLimit: 1100,
      // 使用 esbuild 压缩（默认，更快）
      minify: 'esbuild',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      css: true,
      restoreMocks: true,
      clearMocks: true,
      environmentOptions: {
        jsdom: {
          url: 'http://localhost',
        },
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.d.ts', 'src/**/types.ts'],
      },
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }
})
