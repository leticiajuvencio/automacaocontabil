// Aqui ficam todas as chamadas à API usando o TanStack Query.
// useQuery = buscar dados | useMutation = criar, editar ou excluir
// Depois de cada alteração, mandamos o TanStack Query buscar os dados de novo (invalidateQueries).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './cliente'
import type {
  ConferenciaChave,
  DadosEmpresa,
  DadosNovoExtrato,
  Empresa,
  EnvioDominio,
  Extrato,
  ExtratoResumo,
  Lancamento,
  StatusDominio,
  StatusExtrato,
  Usuario,
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

// ---------- Domínio ----------

export function useStatusDominio() {
  return useQuery({ queryKey: ['dominio'], queryFn: () => api<StatusDominio>('/dominio/status') })
}

export function useConferirChave(empresaId: number) {
  return useMutation({
    mutationFn: (chave: string) =>
      api<ConferenciaChave>(`/empresas/${empresaId}/dominio/conferir`, { metodo: 'POST', corpo: { chave } }),
  })
}

export function useAtivarDominio(empresaId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (chave: string) =>
      api<Empresa>(`/empresas/${empresaId}/dominio/ativar`, { metodo: 'POST', corpo: { chave } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa', empresaId] })
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['dominio'] })
    },
  })
}

export function useDesvincularDominio(empresaId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<Empresa>(`/empresas/${empresaId}/dominio`, { metodo: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa', empresaId] })
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['dominio'] })
    },
  })
}

export function useEnviosDominio() {
  return useQuery({ queryKey: ['envios'], queryFn: () => api<EnvioDominio[]>('/dominio/envios') })
}

export function useEnviarNotas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ empresaId, arquivos }: { empresaId: number; arquivos: File[] }) => {
      const formulario = new FormData()
      formulario.append('empresaId', String(empresaId))
      for (const arquivo of arquivos) formulario.append('arquivos', arquivo)
      return api<EnvioDominio>('/dominio/envios', { metodo: 'POST', formulario })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['envios'] }),
  })
}

export function useConsultarEnvio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<EnvioDominio>(`/dominio/envios/${id}/consultar`, { metodo: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['envios'] }),
  })
}

// ---------- Usuários ----------

export function useUsuarios() {
  return useQuery({ queryKey: ['usuarios'], queryFn: () => api<Usuario[]>('/usuarios') })
}

export function useCriarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: { nome: string; email: string; senha: string; admin: boolean }) =>
      api<Usuario>('/usuarios', { metodo: 'POST', corpo: dados }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useExcluirUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/usuarios/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}
