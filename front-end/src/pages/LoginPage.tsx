import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/contexto'
import { Aviso, Botao, Campo } from '../components/ui'

export function LoginPage() {
  const { sessao, entrar } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [esqueceu, setEsqueceu] = useState(false)

  const destino = (location.state as { de?: string } | null)?.de ?? '/'
  if (sessao) return <Navigate to={destino} replace />

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    setErro(null)
    setEnviando(true)
    try {
      await entrar(String(dados.get('email')), String(dados.get('senha')))
      navigate(destino, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px] rounded-[14px] border border-borda bg-white px-8 pt-5 pb-6">
        <img src="/img/logo-frasson.png" alt="Frasson Contabilidade" className="mx-auto h-[73px] w-auto" />
        <h1 className="mt-4 text-center text-[19px] font-semibold">Automação Contábil</h1>
        <p className="text-center text-[13px] text-suave">Entre para processar os extratos</p>

        <form onSubmit={aoEnviar} className="mt-6 space-y-4">
          <Campo rotulo="E-mail" name="email" type="email" placeholder="voce@frasson.com.br" autoComplete="email" required autoFocus />
          <Campo rotulo="Senha" name="senha" type="password" placeholder="••••••••" autoComplete="current-password" required />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao type="submit" carregando={enviando} className="h-[42px] w-full">
            Entrar
          </Botao>
        </form>

        <div className="mt-2.5 text-right">
          <button type="button" onClick={() => setEsqueceu(true)} className="text-[11px] text-apagado hover:text-suave hover:underline">
            Esqueceu a senha?
          </button>
        </div>
        {esqueceu && (
          <p className="mt-2 text-xs text-suave">
            O acesso é só para a equipe do escritório. Peça para um administrador cadastrar uma senha nova para você em Usuários.
          </p>
        )}
      </div>
    </div>
  )
}
