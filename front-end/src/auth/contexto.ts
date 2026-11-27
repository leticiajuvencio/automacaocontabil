import { createContext, useContext } from 'react'
import type { Sessao } from '../api/tipos'

export interface ContextoAuth {
  sessao: Sessao | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
}

export const AuthContext = createContext<ContextoAuth | null>(null)

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return contexto
}
