import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/contexto'

/** Manda para o login quem não tem sessão, lembrando para onde a pessoa queria ir. */
export function RotaProtegida() {
  const { sessao } = useAuth()
  const location = useLocation()
  if (!sessao) return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />
  return <Outlet />
}
