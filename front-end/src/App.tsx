import { Navigate, createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { RotaProtegida } from './components/RotaProtegida'
import { EmpresasPage } from './pages/EmpresasPage'
import { ExportarPage } from './pages/ExportarPage'
import { LoginPage } from './pages/LoginPage'
import { PainelPage } from './pages/PainelPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <Layout />,
        children: [
          // a revisão abre como modal por cima do painel
          { path: '/', element: <PainelPage />, children: [{ path: 'extratos/:id' }] },
          { path: 'extratos/:id/exportar', element: <ExportarPage /> },
          { path: 'empresas', element: <EmpresasPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
