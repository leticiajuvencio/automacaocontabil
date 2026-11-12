import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import './index.css'
import { router } from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

// No modo demonstração o MSW responde as chamadas /api no lugar do back-end.
async function ligarModoDemo() {
  if (import.meta.env.VITE_MODO_DEMO !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

ligarModoDemo().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-center" richColors closeButton />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
})
