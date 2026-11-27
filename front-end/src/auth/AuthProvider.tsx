import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/cliente'
import type { Sessao } from '../api/tipos'
import { lerSessao, limparSessao, salvarSessao } from './armazenamento'
import { AuthContext } from './contexto'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(lerSessao)
  const queryClient = useQueryClient()

  const entrar = useCallback(async (email: string, senha: string) => {
    const nova = await api<Sessao>('/auth/login', { metodo: 'POST', corpo: { email, senha } })
    salvarSessao(nova)
    setSessao(nova)
  }, [])

  const sair = useCallback(() => {
    limparSessao()
    queryClient.clear()
    setSessao(null)
  }, [queryClient])

  const valor = useMemo(() => ({ sessao, entrar, sair }), [sessao, entrar, sair])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
