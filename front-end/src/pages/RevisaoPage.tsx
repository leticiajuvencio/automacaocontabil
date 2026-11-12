import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { baixar } from '../api/cliente'
import { useEmpresa, useExcluirExtrato, useExtrato, useSalvarEmpresa, useSalvarRevisao } from '../api/consultas'
import type { Empresa, Extrato, Lancamento } from '../api/tipos'
import { contaDoExtrato, montarPartida } from '../contabil/classificar'
import { dadosDaEmpresa } from '../contabil/padroes'
import { lerData } from '../leitor/leitorGenerico'
import { abrirArquivo } from '../lib/download'
import { dataOrdenavel, formatarMoeda, formatarValor, lerValorDigitado, plural } from '../lib/formatar'
import { Aviso, Botao, Carregando, Cartao, CartaoNumero, Etiqueta, Modal, StatusBadge } from '../components/ui'
import { cx, estiloCampo } from '../components/estilos'

// A revisão abre por cima do painel, como o "Modal Revisão" do Figma
export function RevisaoModal({ id, aoFechar }: { id: number; aoFechar: () => void }) {
  const extrato = useExtrato(id)
  const empresa = useEmpresa(extrato.data?.empresaId ?? null)

  if (extrato.isPending || extrato.isError || empresa.isPending || empresa.isError) {
    const erro = extrato.error?.message ?? empresa.error?.message
    return (
      <Modal aberto rotulo="Revisão do extrato" aoFechar={aoFechar} largura="max-w-[970px]">
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : <Carregando />}
      </Modal>
    )
  }

  // key: quando troca de extrato, o formulário começa do zero
  return <Revisao key={extrato.data.id} extrato={extrato.data} empresa={empresa.data} aoFechar={aoFechar} />
}

type Edicao = { data: string; historico: string; detalhe: string; documento: string; valor: string; tipo: 'C' | 'D' }

function Revisao({ extrato, empresa, aoFechar }: { extrato: Extrato; empresa: Empresa; aoFechar: () => void }) {
  const navigate = useNavigate()
  const salvar = useSalvarRevisao(extrato.id)
  const excluir = useExcluirExtrato()
  const salvarEmpresa = useSalvarEmpresa()

  // cópia local das linhas: só vai para a API quando clicar em "Salvar revisão"
  const [linhas, setLinhas] = useState<Lancamento[]>(extrato.lancamentos)
  const [alterado, setAlterado] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [mostrarTexto, setMostrarTexto] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  // avisa antes de fechar a aba com alterações não salvas
  useEffect(() => {
    if (!alterado) return
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aoSair)
    return () => window.removeEventListener('beforeunload', aoSair)
  }, [alterado])

  const contaBanco = contaDoExtrato(extrato.info, empresa)
  const partidas = new Map(linhas.map((l) => [l.id, montarPartida(l, empresa, contaBanco)]))

  const noArquivo = linhas.filter((l) => l.incluir && !partidas.get(l.id)?.ignorado)
  const revisadas = linhas.filter((l) => l.revisado).length
  const debitos = linhas.filter((l) => l.tipo === 'D').reduce((t, l) => t + l.valor, 0)
  const creditos = linhas.filter((l) => l.tipo === 'C').reduce((t, l) => t + l.valor, 0)
  const deduzidos = linhas.filter((l) => l.origemTipo === 'deduzido').length
  const semConta = noArquivo.filter((l) => !partidas.get(l.id)?.contrapartida).length
  const contaLida = [extrato.info.agencia, extrato.info.conta].filter(Boolean).join(' / ')

  function fechar() {
    if (alterado && !window.confirm('Sair sem salvar a revisão?')) return
    aoFechar()
  }

  function mudar(novas: Lancamento[]) {
    setLinhas(novas)
    setAlterado(true)
  }

  function alterarLinha(idLinha: number, campos: Partial<Lancamento>) {
    mudar(linhas.map((l) => (l.id === idLinha ? { ...l, ...campos } : l)))
  }

  function comecarEdicao(l: Lancamento) {
    setEditando(l.id)
    setEdicao({ data: l.data, historico: l.historico, detalhe: l.detalhe, documento: l.documento, valor: l.valor ? formatarValor(l.valor) : '', tipo: l.tipo })
  }

  function cancelarEdicao() {
    // linha nova que ainda não foi salva some
    const linha = linhas.find((l) => l.id === editando)
    if (linha && linha.id < 0 && linha.valor === 0) setLinhas(linhas.filter((l) => l.id !== editando))
    setEditando(null)
    setEdicao(null)
  }

  function salvarEdicao() {
    if (!edicao || editando === null) return
    const ano = extrato.competencia.slice(3)
    const data = lerData(edicao.data.trim(), ano)
    const valor = lerValorDigitado(edicao.valor)
    if (!data) {
      toast.error('Data inválida. Use dd/mm/aaaa.')
      return
    }
    if (!(valor > 0)) {
      toast.error('Informe um valor maior que zero.')
      return
    }

    const novas = linhas.map((l) =>
      l.id === editando
        ? {
            ...l,
            data,
            valor,
            tipo: edicao.tipo,
            historico: edicao.historico.trim() || '(sem descrição)',
            detalhe: edicao.detalhe.trim(),
            documento: edicao.documento.trim(),
            origemTipo: 'manual' as const,
          }
        : l,
    )
    mudar(novas.sort((a, b) => dataOrdenavel(a.data).localeCompare(dataOrdenavel(b.data))))
    setEditando(null)
    setEdicao(null)
  }

  function incluirLinha() {
    // id negativo = linha nova; o back-end troca pelo id do banco ao salvar
    const novoId = Math.min(0, ...linhas.map((l) => l.id)) - 1
    const ultima = linhas[linhas.length - 1]
    const nova: Lancamento = {
      id: novoId,
      data: ultima?.data ?? `01/${extrato.competencia}`,
      historico: '',
      detalhe: '',
      documento: '',
      valor: 0,
      tipo: 'D',
      origemTipo: 'manual',
      revisado: false,
      incluir: true,
      contrapartida: '',
    }
    setLinhas([...linhas, nova])
    comecarEdicao(nova)
  }

  function removerLinha(l: Lancamento) {
    const posicao = linhas.indexOf(l)
    mudar(linhas.filter((x) => x.id !== l.id))
    toast(`Lançamento removido: ${l.historico} · ${formatarValor(l.valor)}`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          setLinhas((atuais) => {
            const copia = atuais.filter((x) => x.id !== l.id)
            copia.splice(Math.min(posicao, copia.length), 0, l)
            return copia
          }),
      },
    })
  }

  async function salvarRevisao() {
    const status = linhas.length && linhas.every((l) => l.revisado) ? 'concluido' : linhas.length ? 'revisao' : 'erro'
    try {
      const salvo = await salvar.mutateAsync({ status, lancamentos: linhas })
      setLinhas(salvo.lancamentos)
      setAlterado(false)
      toast.success(status === 'concluido' ? 'Revisão concluída.' : 'Revisão salva.')
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.')
      return false
    }
  }

  async function exportar() {
    if (alterado && !(await salvarRevisao())) return
    navigate(`/extratos/${extrato.id}/exportar`)
  }

  async function adicionarConta() {
    await salvarEmpresa.mutateAsync({
      id: empresa.id,
      dados: {
        ...dadosDaEmpresa(empresa),
        contas: [...empresa.contas, { banco: extrato.banco, agencia: extrato.info.agencia, conta: extrato.info.conta, codigo: '' }],
      },
    })
    toast.success('Conta adicionada. Informe o código contábil dela na empresa.')
  }

  async function abrirPdf() {
    try {
      abrirArquivo(await baixar(`/extratos/${extrato.id}/pdf`))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o PDF.')
    }
  }

  async function excluirExtrato() {
    await excluir.mutateAsync(extrato.id)
    toast.success('Extrato excluído.')
    aoFechar()
  }

  return (
    <Modal aberto rotulo={`Revisão de ${extrato.nomeArquivo}`} aoFechar={fechar} largura="max-w-[970px]">
      <div className="mb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <h2 className="text-lg font-semibold break-all">{extrato.nomeArquivo}</h2>
            <StatusBadge status={extrato.status} />
          </div>
          <p className="mt-1 text-sm text-suave">
            {[empresa.razaoSocial, extrato.banco && `Banco ${extrato.banco}`, contaLida && `conta ${contaLida}`, `competência ${extrato.competencia}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-apagado">
            <span>
              {extrato.metodo} · enviado por {extrato.usuarioNome}
            </span>
            <button type="button" onClick={abrirPdf} className="font-medium text-marca-escura hover:underline">
              abrir PDF
            </button>
            <button type="button" onClick={() => setMostrarTexto(!mostrarTexto)} className="font-medium text-marca-escura hover:underline">
              {mostrarTexto ? 'esconder texto do PDF' : 'texto do PDF'}
            </button>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CartaoNumero rotulo="linhas" valor={linhas.length} />
        <CartaoNumero rotulo="revisadas" valor={`${revisadas} / ${linhas.length}`} cor={revisadas === linhas.length && linhas.length ? 'text-ok' : undefined} />
        <CartaoNumero rotulo="débitos" valor={formatarMoeda(debitos)} />
        <CartaoNumero rotulo="créditos" valor={formatarMoeda(creditos)} />
      </div>

      <div className="mt-4 space-y-2">
        {extrato.aviso && <Aviso tipo="alerta">{extrato.aviso}</Aviso>}
        {!contaBanco && (
          <Aviso
            tipo="alerta"
            acoes={
              extrato.info.conta && (
                <Botao variante="secundario" pequeno onClick={adicionarConta} carregando={salvarEmpresa.isPending}>
                  Adicionar à empresa
                </Botao>
              )
            }
          >
            A conta {contaLida || 'deste extrato'} não está cadastrada em {empresa.razaoSocial}.
          </Aviso>
        )}
        {contaBanco && !contaBanco.codigo && (
          <Aviso tipo="alerta">
            Falta o código contábil da conta {contaBanco.conta} no cadastro da empresa.
          </Aviso>
        )}
        {deduzidos > 0 && (
          <Aviso tipo="alerta">
            {plural(deduzidos, 'lançamento veio', 'lançamentos vieram')} sem indicação de entrada/saída no PDF. Confira os marcados com
            “D/C?”.
          </Aviso>
        )}
        {semConta > 0 && (
          <Aviso tipo="info">
            {plural(semConta, 'lançamento está', 'lançamentos estão')} sem contrapartida. Digite a conta na linha ou complete as regras da
            empresa; o Domínio recusa linha sem conta.
          </Aviso>
        )}
      </div>

      {mostrarTexto && (
        <pre className="mt-4 max-h-72 overflow-auto rounded-[14px] border border-borda bg-white p-4 text-xs leading-relaxed whitespace-pre text-suave">
          {extrato.textoPdf || '(o PDF não tem texto)'}
        </pre>
      )}

      <Cartao className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-linha text-left text-xs text-suave">
                <th className="w-12 px-4 py-3 text-center font-normal">ok</th>
                <th className="px-2 py-3 font-normal">data</th>
                <th className="px-2 py-3 font-normal">histórico</th>
                <th className="px-2 py-3 text-right font-normal">valor</th>
                <th className="px-2 py-3 text-center font-normal">tipo</th>
                <th className="px-2 py-3 font-normal">contrapartida</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) =>
                l.id === editando && edicao ? (
                  <LinhaEmEdicao key={l.id} edicao={edicao} mudar={setEdicao} salvar={salvarEdicao} cancelar={cancelarEdicao} />
                ) : (
                  <LinhaRevisao
                    key={l.id}
                    lancamento={l}
                    partida={partidas.get(l.id)!}
                    alterar={(campos) => alterarLinha(l.id, campos)}
                    editar={() => comecarEdicao(l)}
                    remover={() => removerLinha(l)}
                  />
                ),
              )}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-suave">
                    Nenhum lançamento. Use “Incluir lançamento” para digitar as linhas do extrato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-linha px-4 py-3">
          <Botao variante="fantasma" pequeno icone={<Plus className="size-3.5" />} onClick={incluirLinha} disabled={editando !== null}>
            Incluir lançamento
          </Botao>
          <Botao
            variante="fantasma"
            pequeno
            onClick={() => mudar(linhas.map((l) => ({ ...l, revisado: true })))}
            disabled={!linhas.length || revisadas === linhas.length}
          >
            Marcar todas como revisadas
          </Botao>
          <span className="ml-auto text-xs text-apagado">{plural(noArquivo.length, 'linha vai', 'linhas vão')} para o TXT</span>
        </div>
      </Cartao>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={fechar} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <ArrowLeft className="size-4" /> voltar à lista
        </button>
        {confirmarExclusao ? (
          <span className="flex items-center gap-2 text-sm text-erro">
            Excluir este extrato?
            <Botao variante="perigo" pequeno onClick={excluirExtrato} carregando={excluir.isPending}>
              Excluir
            </Botao>
            <Botao variante="fantasma" pequeno onClick={() => setConfirmarExclusao(false)}>
              Cancelar
            </Botao>
          </span>
        ) : (
          <Botao variante="fantasma" pequeno onClick={() => setConfirmarExclusao(true)}>
            Excluir extrato
          </Botao>
        )}
        <div className="ml-auto flex items-center gap-3">
          {alterado && <span className="text-xs text-alerta">Alterações não salvas</span>}
          <Botao variante="secundario" onClick={salvarRevisao} carregando={salvar.isPending} disabled={editando !== null}>
            Salvar revisão
          </Botao>
          <Botao onClick={exportar} disabled={editando !== null || !linhas.length}>
            Exportar TXT
          </Botao>
        </div>
      </div>
    </Modal>
  )
}

function LinhaRevisao({
  lancamento: l,
  partida,
  alterar,
  editar,
  remover,
}: {
  lancamento: Lancamento
  partida: ReturnType<typeof montarPartida>
  alterar: (campos: Partial<Lancamento>) => void
  editar: () => void
  remover: () => void
}) {
  const fora = !l.incluir || partida.ignorado
  const semConta = !fora && !partida.contrapartida

  return (
    <tr className={cx('border-b border-linha last:border-0', fora && 'text-apagado')}>
      <td className="px-4 py-2.5 text-center">
        <input
          type="checkbox"
          aria-label="Linha revisada"
          checked={l.revisado}
          onChange={(e) => alterar({ revisado: e.target.checked })}
          className="size-4 cursor-pointer accent-ok-forte"
        />
      </td>
      <td className="px-2 py-2.5 tabular-nums">{l.data.slice(0, 5)}</td>
      <td className="max-w-[300px] px-2 py-2.5">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className={cx(fora && 'line-through')}>{l.historico}</span>
          {l.origemTipo === 'deduzido' && <Etiqueta className="bg-alerta-clara text-alerta">D/C?</Etiqueta>}
          {l.origemTipo === 'manual' && <Etiqueta>editado</Etiqueta>}
        </p>
        {(l.detalhe || l.documento) && (
          <p className="truncate text-xs text-apagado">{[l.detalhe, l.documento && `Doc ${l.documento}`].filter(Boolean).join(' · ')}</p>
        )}
      </td>
      <td className={cx('px-2 py-2.5 text-right tabular-nums', fora && 'line-through')}>
        {l.tipo === 'D' ? '-' : ''}
        {formatarValor(l.valor)}
      </td>
      <td className="px-2 py-2.5 text-center">
        <span
          className={cx(
            'inline-flex h-[21px] w-[29px] items-center justify-center rounded-full text-xs font-semibold',
            l.tipo === 'C' ? 'bg-ok-clara text-ok' : 'bg-erro-clara text-erro',
          )}
        >
          {l.tipo}
        </span>
      </td>
      <td className="px-2 py-2.5">
        {partida.ignorado ? (
          <Etiqueta>Rende Fácil · ignorado</Etiqueta>
        ) : (
          <div className="flex items-center gap-2">
            <input
              aria-label="Contrapartida"
              inputMode="numeric"
              value={l.contrapartida}
              placeholder={partida.conta || 'conta'}
              title={`débito ${partida.debito || '?'} → crédito ${partida.credito || '?'}`}
              onChange={(e) => alterar({ contrapartida: e.target.value })}
              className={cx(estiloCampo, 'h-8 w-20 px-2 tabular-nums', semConta && 'border-alerta bg-alerta-clara')}
            />
            <span className={cx('truncate text-xs', partida.padrao ? 'text-alerta' : 'text-suave')} title={partida.regra}>
              {partida.regra}
            </span>
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <BotaoIcone rotulo="Editar" onClick={editar}>
          <Pencil className="size-3.5" />
        </BotaoIcone>
        {!partida.ignorado && (
          <BotaoIcone rotulo={l.incluir ? 'Tirar do TXT' : 'Voltar para o TXT'} onClick={() => alterar({ incluir: !l.incluir })}>
            {l.incluir ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </BotaoIcone>
        )}
        <BotaoIcone rotulo="Remover" onClick={remover} perigo>
          <Trash2 className="size-3.5" />
        </BotaoIcone>
      </td>
    </tr>
  )
}

function LinhaEmEdicao({
  edicao,
  mudar,
  salvar,
  cancelar,
}: {
  edicao: Edicao
  mudar: (e: Edicao) => void
  salvar: () => void
  cancelar: () => void
}) {
  const campo = (nome: keyof Edicao) => ({
    value: edicao[nome],
    onChange: (e: { target: { value: string } }) => mudar({ ...edicao, [nome]: e.target.value }),
  })

  return (
    <tr
      className="border-b border-linha bg-marca-fundo align-top"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          salvar()
        }
        if (e.key === 'Escape') {
          // o Esc cancela só a edição, sem fechar o modal
          e.stopPropagation()
          cancelar()
        }
      }}
    >
      <td />
      <td className="px-2 py-2.5">
        <input aria-label="Data" placeholder="dd/mm/aaaa" className={cx(estiloCampo, 'h-8 w-[104px] bg-white px-2')} autoFocus {...campo('data')} />
      </td>
      <td className="px-2 py-2.5" colSpan={1}>
        <div className="flex min-w-[240px] flex-col gap-1.5">
          <input aria-label="Histórico" placeholder="Histórico (ex.: Pix enviado)" className={cx(estiloCampo, 'h-8 bg-white px-2')} {...campo('historico')} />
          <input aria-label="Detalhe" placeholder="Detalhe / favorecido" className={cx(estiloCampo, 'h-8 bg-white px-2')} {...campo('detalhe')} />
          <input aria-label="Documento" placeholder="Nº documento" className={cx(estiloCampo, 'h-8 bg-white px-2')} {...campo('documento')} />
        </div>
      </td>
      <td className="px-2 py-2.5 text-right">
        <input aria-label="Valor" inputMode="decimal" placeholder="0,00" className={cx(estiloCampo, 'h-8 w-24 bg-white px-2 text-right tabular-nums')} {...campo('valor')} />
      </td>
      <td className="px-2 py-2.5" colSpan={2}>
        <select aria-label="Entrada ou saída" className={cx(estiloCampo, 'h-8 bg-white px-2')} {...campo('tipo')}>
          <option value="C">C · entrada (crédito)</option>
          <option value="D">D · saída (débito)</option>
        </select>
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <Botao pequeno onClick={salvar}>
          Salvar
        </Botao>
        <Botao pequeno variante="fantasma" onClick={cancelar} className="ml-1">
          Cancelar
        </Botao>
      </td>
    </tr>
  )
}

function BotaoIcone({ rotulo, onClick, perigo, children }: { rotulo: string; onClick: () => void; perigo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      className={cx('rounded-md p-1.5 text-apagado hover:bg-linha', perigo ? 'hover:text-erro' : 'hover:text-texto')}
    >
      {children}
    </button>
  )
}
