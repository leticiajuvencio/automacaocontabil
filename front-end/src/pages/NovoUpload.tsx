import { FileUp, Loader2 } from 'lucide-react'
import { useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useEmpresas, useEnviarExtrato, useSalvarEmpresa } from '../api/consultas'
import type { Empresa } from '../api/tipos'
import { empresaDoExtrato } from '../contabil/classificar'
import { empresaEmBranco } from '../contabil/padroes'
import type { ResultadoLeitura } from '../leitor'
import { competenciaDaData, dataOrdenavel, mascararCnpj, plural } from '../lib/formatar'
import { Aviso, Botao, Campo, Modal, Selecao } from '../components/ui'
import { cx } from '../components/estilos'

const NOVA_EMPRESA = 'nova'

/** Últimos 18 meses no formato mm/aaaa, do mais novo para o mais antigo. */
function ultimasCompetencias(): string[] {
  const hoje = new Date()
  return Array.from({ length: 18 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  })
}

/** A competência é o mês que mais aparece nas datas dos lançamentos. */
function competenciaDoExtrato(leitura: ResultadoLeitura): string {
  const contagem: Record<string, number> = {}
  for (const l of leitura.lancamentos) contagem[competenciaDaData(l.data)] = (contagem[competenciaDaData(l.data)] ?? 0) + 1
  return Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0] ?? ultimasCompetencias()[0]
}

export function NovoUpload({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const navigate = useNavigate()
  const empresas = useEmpresas()
  const salvarEmpresa = useSalvarEmpresa()
  const enviar = useEnviarExtrato()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [banco, setBanco] = useState('')
  const [competencia, setCompetencia] = useState(ultimasCompetencias()[0])

  function limpar() {
    setArquivo(null)
    setLeitura(null)
    setErro(null)
    setEmpresaId('')
    setBanco('')
    setCompetencia(ultimasCompetencias()[0])
  }

  function fechar() {
    limpar()
    aoFechar()
  }

  async function escolherArquivo(novo: File | undefined) {
    if (!novo) return
    if (!/\.pdf$/i.test(novo.name) && novo.type !== 'application/pdf') {
      setErro('Escolha um arquivo PDF.')
      return
    }
    limpar()
    setArquivo(novo)
    setLendo(true)
    try {
      // o PDF.js é pesado: só carrega quando a pessoa escolhe um arquivo
      const { lerExtrato } = await import('../leitor')
      const resultado = await lerExtrato(novo)
      setLeitura(resultado)
      setBanco(resultado.info.banco)
      if (resultado.lancamentos.length) setCompetencia(competenciaDoExtrato(resultado))
      // tenta achar a empresa pela conta ou pelo CNPJ do PDF
      const achou = empresaDoExtrato(resultado.info, empresas.data ?? [])
      if (achou) setEmpresaId(String(achou.id))
      else if (resultado.info.cliente || resultado.info.documento) setEmpresaId(NOVA_EMPRESA)
    } catch {
      setErro('Não consegui abrir este PDF. Ele pode estar protegido por senha ou corrompido.')
    } finally {
      setLendo(false)
    }
  }

  function soltar(evento: DragEvent) {
    evento.preventDefault()
    setArrastando(false)
    escolherArquivo(evento.dataTransfer.files[0])
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!arquivo || !leitura) return
    setErro(null)
    try {
      let empresa: Empresa | undefined = empresas.data?.find((e) => e.id === Number(empresaId))
      if (empresaId === NOVA_EMPRESA) {
        // cadastra a empresa com os dados que vieram no PDF
        const { info } = leitura
        empresa = await salvarEmpresa.mutateAsync({
          dados: empresaEmBranco({
            razaoSocial: info.cliente || arquivo.name.replace(/\.pdf$/i, ''),
            cnpj: mascararCnpj(info.documento),
            contas: info.conta ? [{ banco, agencia: info.agencia, conta: info.conta, codigo: '' }] : [],
          }),
        })
      }
      if (!empresa) {
        setErro('Escolha a empresa cliente.')
        return
      }

      const extrato = await enviar.mutateAsync({
        arquivo,
        dados: {
          empresaId: empresa.id,
          competencia,
          banco,
          metodo: leitura.metodo,
          aviso: leitura.aviso,
          info: { ...leitura.info, banco },
          textoPdf: leitura.textoPdf,
          lancamentos: leitura.lancamentos.map((l) => ({ ...l, revisado: false, incluir: true, contrapartida: '' })),
        },
      })
      fechar()
      navigate(`/extratos/${extrato.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o extrato.')
    }
  }

  const competencias = [...new Set([competencia, ...ultimasCompetencias()])]
  const datas = leitura?.lancamentos.map((l) => l.data).sort((a, b) => dataOrdenavel(a).localeCompare(dataOrdenavel(b))) ?? []

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo="Novo upload" descricao="Envie o extrato em PDF para processar.">
      <form onSubmit={aoEnviar} className="space-y-4">
        <Selecao rotulo="Empresa cliente" name="empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
          <option value="" disabled>
            Escolha a empresa
          </option>
          {leitura && (leitura.info.cliente || leitura.info.documento) && (
            <option value={NOVA_EMPRESA}>+ Cadastrar {leitura.info.cliente || 'nova empresa'} (dados do PDF)</option>
          )}
          {empresas.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razaoSocial}
            </option>
          ))}
        </Selecao>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Banco" name="banco" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Lido do PDF" />
          <Selecao rotulo="Competência" name="competencia" value={competencia} onChange={(e) => setCompetencia(e.target.value)}>
            {competencias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-suave">Arquivo PDF</span>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            className={cx(
              'flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
              arrastando ? 'border-marca bg-marca-fundo' : 'border-[#cfcfcb] bg-[#fbfbfa] hover:border-marca/60',
            )}
          >
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => escolherArquivo(e.target.files?.[0])} />
            <span className="mb-2 flex size-[30px] items-center justify-center rounded-md bg-linha text-suave">
              {lendo ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            </span>
            {arquivo ? (
              <>
                <span className="text-sm font-medium break-all">{arquivo.name}</span>
                <span className="mt-1 text-xs text-suave">
                  {lendo
                    ? 'Lendo o PDF…'
                    : leitura &&
                      [
                        leitura.info.agencia && leitura.info.conta && `Ag. ${leitura.info.agencia} / conta ${leitura.info.conta}`,
                        plural(leitura.lancamentos.length, 'lançamento', 'lançamentos'),
                        datas.length && `${datas[0].slice(0, 5)} a ${datas[datas.length - 1].slice(0, 5)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
                <span className="mt-2 text-xs text-apagado">clique para trocar</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">Arraste o PDF aqui</span>
                <span className="mt-1 text-xs text-apagado">ou clique para escolher</span>
              </>
            )}
          </label>
        </div>

        {leitura?.aviso && <Aviso tipo="alerta">{leitura.aviso}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <Botao type="submit" className="h-11 w-full" disabled={!leitura || lendo} carregando={salvarEmpresa.isPending || enviar.isPending}>
          Enviar e processar
        </Botao>
      </form>
    </Modal>
  )
}
