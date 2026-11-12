import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useCriarUsuario, useExcluirUsuario, useUsuarios } from '../api/consultas'
import { useAuth } from '../auth/contexto'
import { Aviso, Botao, CabecalhoPagina, Campo, Carregando, Cartao, Etiqueta, Marcador, TituloCartao } from '../components/ui'
import { formatarDataHora } from '../lib/formatar'

export function UsuariosPage() {
  const { sessao } = useAuth()
  const usuarios = useUsuarios()
  const criar = useCriarUsuario()
  const excluir = useExcluirUsuario()
  const [admin, setAdmin] = useState(false)

  async function aoCriar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    try {
      await criar.mutateAsync({
        nome: String(dados.get('nome')),
        email: String(dados.get('email')),
        senha: String(dados.get('senha')),
        admin,
      })
      formulario.reset()
      setAdmin(false)
      toast.success('Usuário cadastrado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível cadastrar.')
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Usuários" descricao="Quem pode entrar no sistema" />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <Cartao className="overflow-hidden">
          {usuarios.isPending ? (
            <Carregando />
          ) : usuarios.isError ? (
            <div className="p-5">
              <Aviso tipo="erro">{usuarios.error.message}</Aviso>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-xs text-suave">
                  <th className="px-4 py-3 font-normal">nome</th>
                  <th className="px-4 py-3 font-normal">cadastro</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {usuarios.data.map((u) => (
                  <tr key={u.id} className="border-b border-linha last:border-0">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium">
                        {u.nome} {u.admin && <Etiqueta className="bg-marca-clara text-marca-escura">admin</Etiqueta>}
                      </p>
                      <p className="text-xs text-apagado">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-suave tabular-nums">{formatarDataHora(u.dataCadastro)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== sessao?.usuario.id && (
                        <button
                          type="button"
                          title="Excluir"
                          aria-label={`Excluir ${u.nome}`}
                          onClick={() => excluir.mutate(u.id)}
                          className="rounded-md p-1.5 text-apagado hover:bg-linha hover:text-erro"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Cartao>

        <Cartao>
          <TituloCartao titulo="Novo usuário" descricao="O site é fechado: só entra quem for cadastrado aqui." />
          <form onSubmit={aoCriar} className="space-y-4 p-5">
            <Campo rotulo="Nome" name="nome" required />
            <Campo rotulo="E-mail" name="email" type="email" required />
            <Campo rotulo="Senha provisória" name="senha" type="password" minLength={6} required ajuda="Mínimo de 6 caracteres." />
            <Marcador rotulo="Administrador (pode cadastrar usuários)" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
            <Botao type="submit" className="w-full" carregando={criar.isPending}>
              Cadastrar
            </Botao>
          </form>
        </Cartao>
      </div>
    </>
  )
}
