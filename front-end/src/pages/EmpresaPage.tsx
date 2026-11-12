import { ArrowLeft, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useEmpresa, useExcluirEmpresa, useSalvarEmpresa } from '../api/consultas'
import type { ContaBancaria, DadosEmpresa, Empresa, Regra } from '../api/tipos'
import { dadosDaEmpresa, empresaEmBranco } from '../contabil/padroes'
import { mascararCnpj } from '../lib/formatar'
import { VinculoDominio } from '../components/VinculoDominio'
import { Aviso, Botao, Campo, Carregando, Cartao, Selecao, TituloCartao } from '../components/ui'
import { cx, estiloCampo } from '../components/estilos'

export function EmpresaPage() {
  const parametro = useParams().id
  const nova = parametro === 'nova'
  const empresa = useEmpresa(nova ? null : Number(parametro))

  if (nova) return <FormularioEmpresa />
  if (empresa.isPending) return <Carregando />
  if (empresa.isError) return <Aviso tipo="erro">{empresa.error.message}</Aviso>
  return <FormularioEmpresa key={empresa.data.id} empresa={empresa.data} />
}

function FormularioEmpresa({ empresa }: { empresa?: Empresa }) {
  const navigate = useNavigate()
  const salvar = useSalvarEmpresa()
  const excluir = useExcluirEmpresa()
  const [dados, setDados] = useState<DadosEmpresa>(empresa ? dadosDaEmpresa(empresa) : empresaEmBranco())
  const [alterado, setAlterado] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  function mudar(campos: Partial<DadosEmpresa>) {
    setDados({ ...dados, ...campos })
    setAlterado(true)
  }

  function mudarConta(i: number, campos: Partial<ContaBancaria>) {
    mudar({ contas: dados.contas.map((c, j) => (j === i ? { ...c, ...campos } : c)) })
  }

  function mudarRegra(i: number, campos: Partial<Regra>) {
    mudar({ regras: dados.regras.map((r, j) => (j === i ? { ...r, ...campos } : r)) })
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    try {
      const salva = await salvar.mutateAsync({ id: empresa?.id, dados })
      setAlterado(false)
      toast.success(empresa ? 'Alterações salvas.' : 'Empresa cadastrada.')
      if (!empresa) navigate(`/empresas/${salva.id}`, { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function excluirEmpresa() {
    if (!empresa) return
    await excluir.mutateAsync(empresa.id)
    toast.success('Empresa excluída.')
    navigate('/empresas')
  }

  const contasSemCodigo = dados.contas.filter((c) => !c.codigo.trim()).length

  return (
    <form onSubmit={aoSalvar}>
      <Link to="/empresas" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
        <ArrowLeft className="size-4" /> empresas
      </Link>
      <h1 className="mb-1 text-[22px] font-semibold">{empresa ? dados.razaoSocial || 'Sem nome' : 'Nova empresa'}</h1>
      <p className="mb-5 text-sm text-suave">Cadastro, contas e regras usadas para classificar os extratos.</p>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Cartao>
          <TituloCartao titulo="Dados da empresa" />
          <div className="space-y-4 p-5">
            <Campo rotulo="Razão social" value={dados.razaoSocial} onChange={(e) => mudar({ razaoSocial: e.target.value })} required />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                rotulo="CNPJ"
                value={dados.cnpj}
                onChange={(e) => mudar({ cnpj: mascararCnpj(e.target.value) })}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
              />
              <Campo
                rotulo="Código no Domínio"
                value={dados.codigoDominio}
                onChange={(e) => mudar({ codigoDominio: e.target.value })}
                inputMode="numeric"
              />
            </div>
          </div>
        </Cartao>

        <Cartao>
          <TituloCartao titulo="Contrapartidas padrão" descricao="Usadas quando nenhuma regra se aplica." />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Entradas · conta" value={dados.contaEntrada} onChange={(e) => mudar({ contaEntrada: e.target.value })} inputMode="numeric" />
              <Campo rotulo="Entradas · histórico" value={dados.historicoEntrada} onChange={(e) => mudar({ historicoEntrada: e.target.value })} inputMode="numeric" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Saídas · conta" value={dados.contaSaida} onChange={(e) => mudar({ contaSaida: e.target.value })} inputMode="numeric" />
              <Campo rotulo="Saídas · histórico" value={dados.historicoSaida} onChange={(e) => mudar({ historicoSaida: e.target.value })} inputMode="numeric" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Selecao
                rotulo="Aplicação automática (Rende Fácil)"
                value={dados.rendeFacil}
                onChange={(e) => mudar({ rendeFacil: e.target.value as DadosEmpresa['rendeFacil'] })}
              >
                <option value="ignorar">Ignorar</option>
                <option value="contabilizar">Contabilizar</option>
              </Selecao>
              {dados.rendeFacil === 'contabilizar' && (
                <Campo rotulo="Conta da aplicação" value={dados.contaAplicacao} onChange={(e) => mudar({ contaAplicacao: e.target.value })} inputMode="numeric" />
              )}
            </div>
          </div>
        </Cartao>

        <Cartao className="lg:col-span-2">
          <TituloCartao
            titulo="Contas bancárias"
            descricao="O extrato é ligado à conta pela agência e pelo número lidos do PDF."
            acoes={
              <Botao pequeno variante="secundario" onClick={() => mudar({ contas: [...dados.contas, { banco: '', agencia: '', conta: '', codigo: '' }] })}>
                + Conta
              </Botao>
            }
          />
          <TabelaEditavel
            colunas={['Banco', 'Agência', 'Conta', 'Cód. contábil']}
            vazio="Nenhuma conta. Adicione a conta bancária e o código reduzido dela no Domínio."
            linhas={dados.contas.map((c, i) => ({
              campos: [
                <input key="b" aria-label="Banco" value={c.banco} onChange={(e) => mudarConta(i, { banco: e.target.value })} className={campoTabela} />,
                <input key="a" aria-label="Agência" value={c.agencia} onChange={(e) => mudarConta(i, { agencia: e.target.value })} className={campoTabela} />,
                <input key="c" aria-label="Conta" value={c.conta} onChange={(e) => mudarConta(i, { conta: e.target.value })} className={campoTabela} />,
                <input
                  key="d"
                  aria-label="Código contábil"
                  inputMode="numeric"
                  value={c.codigo}
                  onChange={(e) => mudarConta(i, { codigo: e.target.value })}
                  className={cx(campoTabela, !c.codigo.trim() && 'border-alerta bg-alerta-clara')}
                />,
              ],
              remover: () => mudar({ contas: dados.contas.filter((_, j) => j !== i) }),
            }))}
          />
          {contasSemCodigo > 0 && (
            <p className="px-5 pb-4 text-xs text-alerta">Sem o código contábil da conta, o TXT sai sem a conta do banco.</p>
          )}
        </Cartao>

        <Cartao className="lg:col-span-2">
          <TituloCartao
            titulo="Regras de classificação"
            descricao="A primeira palavra-chave encontrada no histórico define a contrapartida."
            acoes={
              <Botao pequeno variante="secundario" onClick={() => mudar({ regras: [...dados.regras, { termo: '', descricao: '', conta: '', historico: '' }] })}>
                + Regra
              </Botao>
            }
          />
          <TabelaEditavel
            colunas={['Palavra-chave', 'Descrição', 'Conta', 'Histórico']}
            vazio="Nenhuma regra. Tudo vai para a contrapartida padrão."
            linhas={dados.regras.map((r, i) => ({
              campos: [
                <input key="t" aria-label="Palavra-chave" value={r.termo} onChange={(e) => mudarRegra(i, { termo: e.target.value })} className={campoTabela} />,
                <input key="d" aria-label="Descrição" value={r.descricao} onChange={(e) => mudarRegra(i, { descricao: e.target.value })} className={campoTabela} />,
                <input
                  key="c"
                  aria-label="Conta"
                  inputMode="numeric"
                  value={r.conta}
                  onChange={(e) => mudarRegra(i, { conta: e.target.value })}
                  className={cx(campoTabela, !r.conta.trim() && 'border-alerta bg-alerta-clara')}
                />,
                <input key="h" aria-label="Histórico" inputMode="numeric" value={r.historico} onChange={(e) => mudarRegra(i, { historico: e.target.value })} className={campoTabela} />,
              ],
              remover: () => mudar({ regras: dados.regras.filter((_, j) => j !== i) }),
            }))}
          />
        </Cartao>

        {empresa && (
          <div className="lg:col-span-2">
            <VinculoDominio empresa={empresa} />
          </div>
        )}
      </div>

      {empresa && (
        <div className="mt-6">
          {confirmarExclusao ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-erro">
              Excluir {empresa.razaoSocial} e todos os extratos dela?
              <Botao variante="perigo" pequeno onClick={excluirEmpresa} carregando={excluir.isPending}>
                Excluir
              </Botao>
              <Botao variante="fantasma" pequeno onClick={() => setConfirmarExclusao(false)}>
                Cancelar
              </Botao>
            </span>
          ) : (
            <Botao variante="fantasma" pequeno className="text-erro" onClick={() => setConfirmarExclusao(true)}>
              Excluir esta empresa
            </Botao>
          )}
        </div>
      )}

      {/* barra de salvar fica presa no rodapé enquanto houver alteração */}
      {(alterado || !empresa) && (
        <div className="sticky bottom-0 mt-6 -mx-4 flex items-center justify-end gap-3 border-t border-borda bg-fundo/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
          {alterado && <span className="text-xs text-alerta">Alterações não salvas</span>}
          <Botao type="submit" carregando={salvar.isPending}>
            {empresa ? 'Salvar alterações' : 'Cadastrar empresa'}
          </Botao>
        </div>
      )}
    </form>
  )
}

const campoTabela = cx(estiloCampo, 'h-8 w-full bg-white px-2')

function TabelaEditavel({
  colunas,
  linhas,
  vazio,
}: {
  colunas: string[]
  linhas: { campos: ReactNode[]; remover: () => void }[]
  vazio: string
}) {
  if (!linhas.length) return <p className="px-5 py-6 text-center text-sm text-suave">{vazio}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs text-suave">
            {colunas.map((c) => (
              <th key={c} className="px-2 pt-3 pb-1 font-normal first:pl-5">
                {c}
              </th>
            ))}
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {linha.campos.map((campo, j) => (
                <td key={j} className="px-2 py-1.5 first:pl-5">
                  {campo}
                </td>
              ))}
              <td className="pr-4 text-right">
                <button type="button" onClick={linha.remover} aria-label="Remover" className="rounded-md p-1.5 text-apagado hover:bg-linha hover:text-erro">
                  <X className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
