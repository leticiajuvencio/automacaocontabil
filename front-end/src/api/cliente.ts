import { lerSessao, limparSessao } from '../auth/armazenamento'

export class ErroApi extends Error {
  readonly status: number

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

type Opcoes = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  corpo?: unknown
  formulario?: FormData
}

async function requisitar(caminho: string, { metodo = 'GET', corpo, formulario }: Opcoes = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = lerSessao()?.token
  if (token) headers.Authorization = `Bearer ${token}`
  if (corpo !== undefined) headers['Content-Type'] = 'application/json'

  let resposta: Response
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      headers,
      body: formulario ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined),
    })
  } catch {
    throw new ErroApi(0, 'Não foi possível falar com o servidor. Verifique se o back-end está rodando.')
  }

  if (resposta.status === 401 && token) {
    limparSessao()
    window.location.assign('/login')
  }

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null)
    throw new ErroApi(resposta.status, dados?.erro ?? `Erro ${resposta.status}`)
  }
  return resposta
}

export async function api<T>(caminho: string, opcoes?: Opcoes): Promise<T> {
  const resposta = await requisitar(caminho, opcoes)
  return resposta.status === 204 ? (undefined as T) : resposta.json()
}

/** Baixa um arquivo da API (com o token), ex.: o PDF original do extrato. */
export async function baixar(caminho: string): Promise<Blob> {
  const resposta = await requisitar(caminho)
  return resposta.blob()
}
