// Aqui ficam todas as chamadas à API usando o TanStack Query.
// useQuery = buscar dados | useMutation = criar, editar ou excluir
// Depois de cada alteração, mandamos o TanStack Query buscar os dados de novo (invalidateQueries).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './cliente'
import type {
  DadosEmpresa,
  DadosNovoExtrato,
  Empresa,
  Extrato,
  ExtratoResumo,
  Lancamento,
  StatusExtrato,
} from './tipos'

// ---------- Empresas ----------

export function useEmpresas() {
  return useQuery({ queryKey: ['empresas'], queryFn: () => api<Empresa[]>('/empresas') })
}

export function useEmpresa(id: number | null) {
  return useQuery({
    queryKey: ['empresa', id],
    queryFn: () => api<Empresa>(`/empresas/${id}`),
    enabled: id !== null,
  })
}

export function useSalvarEmpresa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: number; dados: DadosEmpresa }) => {
      if (id) return api<Empresa>(`/empresas/${id}`, { metodo: 'PUT', corpo: dados })
      return api<Empresa>('/empresas', { metodo: 'POST', corpo: dados })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['empresa'] })
    },
  })
}

export function useExcluirEmpresa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/empresas/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['extratos'] })
    },
  })
}

// ---------- Extratos ----------

export function useExtratos(filtros: { empresaId?: number; competencia?: string; status?: StatusExtrato }) {
  const params = new URLSearchParams()
  if (filtros.empresaId) params.set('empresaId', String(filtros.empresaId))
  if (filtros.competencia) params.set('competencia', filtros.competencia)
  if (filtros.status) params.set('status', filtros.status)

  return useQuery({
    queryKey: ['extratos', filtros],
    queryFn: () => api<ExtratoResumo[]>(`/extratos?${params}`),
  })
}

export function useExtrato(id: number) {
  return useQuery({ queryKey: ['extrato', id], queryFn: () => api<Extrato>(`/extratos/${id}`) })
}

// Recarrega tudo que depende dos extratos (lista, detalhe e contagem nas empresas)
function useRecarregarExtratos() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['extratos'] })
    queryClient.invalidateQueries({ queryKey: ['extrato'] })
    queryClient.invalidateQueries({ queryKey: ['empresas'] })
  }
}

export function useEnviarExtrato() {
  const recarregar = useRecarregarExtratos()
  return useMutation({
    mutationFn: ({ arquivo, dados }: { arquivo: File; dados: DadosNovoExtrato }) => {
      // o PDF vai como formulário (multipart) e os lançamentos lidos vão em JSON junto
      const formulario = new FormData()
      formulario.append('arquivo', arquivo)
      formulario.append('dados', JSON.stringify(dados))
      return api<Extrato>('/extratos', { metodo: 'POST', formulario })
    },
    onSuccess: recarregar,
  })
}

export function useSalvarRevisao(id: number) {
  const recarregar = useRecarregarExtratos()
  return useMutation({
    mutationFn: (dados: { status: StatusExtrato; lancamentos: Lancamento[] }) =>
      api<Extrato>(`/extratos/${id}`, { metodo: 'PUT', corpo: dados }),
    onSuccess: recarregar,
  })
}

export function useExcluirExtrato() {
  const recarregar = useRecarregarExtratos()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/extratos/${id}`, { metodo: 'DELETE' }),
    onSuccess: recarregar,
  })
}
