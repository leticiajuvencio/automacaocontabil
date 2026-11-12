import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { useEmpresa, useExtrato, useSalvarEmpresa } from '../api/consultas'
import type { Empresa, Extrato, OpcoesArquivo } from '../api/tipos'
import { dadosDaEmpresa } from '../contabil/padroes'
import { montarLinhas, montarTxt, nomeBase, paraAnsi } from '../contabil/txt'
import { salvarArquivo } from '../lib/download'
import { formatarMoeda, plural } from '../lib/formatar'
import { Aviso, Botao, Carregando, Cartao, CartaoNumero, Marcador, Selecao, TituloCartao, Campo } from '../components/ui'

export function ExportarPage() {
  const id = Number(useParams().id)
  const extrato = useExtrato(id)
  const empresa = useEmpresa(extrato.data?.empresaId ?? null)

  if (extrato.isError) return <Aviso tipo="erro">{extrato.error.message}</Aviso>
  if (empresa.isError) return <Aviso tipo="erro">{empresa.error.message}</Aviso>
  if (!extrato.data || !empresa.data) return <Carregando />
  return <Exportacao key={id} extratos={[extrato.data]} empresa={empresa.data} titulo={extrato.data.nomeArquivo} voltar={`/extratos/${id}`} />
}

const OPCOES_SEPARADOR = [
  { valor: ';', rotulo: 'Ponto e vírgula ( ; )' },
  { valor: '|', rotulo: 'Barra vertical ( | )' },
  { valor: 'tab', rotulo: 'Tabulação' },
]

function Exportacao({ extratos, empresa, titulo, voltar }: { extratos: Extrato[]; empresa: Empresa; titulo: string; voltar: string }) {
  const salvarEmpresa = useSalvarEmpresa()
  const [opcoes, setOpcoes] = useState<OpcoesArquivo>(empresa.opcoes)
  const opcoesAlteradas = JSON.stringify(opcoes) !== JSON.stringify(empresa.opcoes)

  // as opções da tela valem para a prévia na hora, mesmo antes de salvar na empresa
  const comOpcoes = { ...empresa, opcoes }
  const linhas = montarLinhas(extratos, comOpcoes)
  const txt = montarTxt(linhas, opcoes)
  const nome = nomeBase(empresa, linhas)

  const total = linhas.reduce((t, l) => t + l.lancamento.valor, 0)
  const semConta = linhas.filter((l) => !l.partida.debito || !l.partida.credito).length

  function mudar<C extends keyof OpcoesArquivo>(campo: C, valor: OpcoesArquivo[C]) {
    setOpcoes({ ...opcoes, [campo]: valor })
  }

  function baixarTxt() {
    const blob =
      opcoes.codificacao === 'ansi'
        ? new Blob([paraAnsi(txt)], { type: 'text/plain;charset=windows-1252' })
        : new Blob([txt], { type: 'text/plain;charset=utf-8' })
    salvarArquivo(blob, `dominio_${nome}.txt`)
  }

  async function copiarTxt() {
    try {
      await navigator.clipboard.writeText(txt)
      toast.success('TXT copiado.')
    } catch {
      toast.error('O navegador não deixou copiar. Use "Baixar TXT".')
    }
  }

  async function salvarOpcoes() {
    await salvarEmpresa.mutateAsync({ id: empresa.id, dados: { ...dadosDaEmpresa(empresa), opcoes } })
    toast.success('Opções salvas na empresa.')
  }

  return (
    <>
      <Link to={voltar} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
        <ArrowLeft className="size-4" /> voltar
      </Link>
      <h1 className="text-[22px] font-semibold">Exportar para o Domínio</h1>
      <p className="mt-1 mb-5 text-sm text-suave">
        {titulo} · {plural(extratos.length, 'extrato', 'extratos')}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoNumero rotulo="lançamentos no arquivo" valor={linhas.length} />
        <CartaoNumero rotulo="valor movimentado" valor={formatarMoeda(total)} />
        <CartaoNumero rotulo="sem conta" valor={semConta} cor={semConta ? 'text-erro' : 'text-ok'} />
      </div>

      {semConta > 0 && (
        <div className="mt-3">
          <Aviso tipo="alerta">
            {plural(semConta, 'lançamento está', 'lançamentos estão')} sem conta de débito ou crédito. Complete os códigos na empresa ou na revisão;
            o Domínio recusa linha sem conta.
          </Aviso>
        </div>
      )}

      <Cartao className="mt-4 p-5">
        <p className="font-semibold">Arquivo TXT</p>
        <p className="mt-0.5 text-[13px] text-suave">Leiaute da planilha de importação do Domínio, uma linha por lançamento.</p>
        <div className="mt-4 flex gap-2">
          <Botao onClick={baixarTxt} disabled={!linhas.length}>
            Baixar TXT
          </Botao>
          <Botao variante="secundario" onClick={copiarTxt} disabled={!linhas.length}>
            Copiar
          </Botao>
        </div>
      </Cartao>

      <Cartao className="mt-4 overflow-hidden">
        <PreviaTxt texto={txt} />
      </Cartao>

      <Cartao className="mt-4">
        <TituloCartao
          titulo="Opções do arquivo"
          descricao="Valem para esta exportação. Salve na empresa para usar sempre."
          acoes={
            opcoesAlteradas && (
              <Botao pequeno variante="secundario" onClick={salvarOpcoes} carregando={salvarEmpresa.isPending}>
                Salvar na empresa
              </Botao>
            )
          }
        />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Selecao rotulo="Separador" value={opcoes.separador} onChange={(e) => mudar('separador', e.target.value as OpcoesArquivo['separador'])}>
            {OPCOES_SEPARADOR.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao rotulo="Codificação" value={opcoes.codificacao} onChange={(e) => mudar('codificacao', e.target.value as OpcoesArquivo['codificacao'])}>
            <option value="ansi">ANSI (Windows-1252)</option>
            <option value="utf8">UTF-8</option>
          </Selecao>
          <Selecao rotulo="Inicia lote" value={opcoes.iniciaLote} onChange={(e) => mudar('iniciaLote', e.target.value as OpcoesArquivo['iniciaLote'])}>
            <option value="cada">1 em cada lançamento</option>
            <option value="vazio">Em branco</option>
          </Selecao>
          <Campo rotulo="Matriz/filial" value={opcoes.filial} onChange={(e) => mudar('filial', e.target.value)} inputMode="numeric" />
          <Campo rotulo="C. custo débito" value={opcoes.centroCustoDebito} onChange={(e) => mudar('centroCustoDebito', e.target.value)} />
          <Campo rotulo="C. custo crédito" value={opcoes.centroCustoCredito} onChange={(e) => mudar('centroCustoCredito', e.target.value)} />
          <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-3">
            <Marcador rotulo="Linha de cabeçalho" checked={opcoes.cabecalho} onChange={(e) => mudar('cabecalho', e.target.checked)} />
            <Marcador rotulo="Sem acentos" checked={opcoes.semAcentos} onChange={(e) => mudar('semAcentos', e.target.checked)} />
            <Marcador rotulo="Maiúsculas" checked={opcoes.maiusculas} onChange={(e) => mudar('maiusculas', e.target.checked)} />
            <Marcador
              rotulo="Nº do documento no complemento"
              checked={opcoes.documentoNoComplemento}
              onChange={(e) => mudar('documentoNoComplemento', e.target.checked)}
            />
          </div>
        </div>
      </Cartao>

      <Cartao className="mt-4">
        <TituloCartao titulo="Como importar no Domínio" descricao="Passo a passo da Central de Soluções do Domínio (importar lançamentos contábeis do Excel)." />
        <ol className="list-decimal space-y-1.5 py-4 pr-5 pl-10 text-sm text-[#3d3d3a]">
          <li>
            Uma vez só: em <b>Utilitários › Importação › Importador › Conjunto de dados</b>, importe o conjunto de lançamentos contábeis que a
            Domínio disponibiliza.
          </li>
          <li>
            Acesse <b>Utilitários › Importação › Importador › Importar</b> e, no quadro Arquivo, escolha o tipo <b>TXT</b>.
          </li>
          <li>Em Caminho, selecione o arquivo baixado aqui.</li>
          <li>
            Em Conjunto de dados, escolha <b>Lançamentos Contábeis (Partida Simples/Multiplas) (3.1) (Excel (3.1))</b> e clique em Importar.
          </li>
          <li>
            Confira a guia “Registros a serem gravados” e clique em <b>Gravar</b>. Os lançamentos ficam em Movimentos › Lançamentos.
          </li>
        </ol>
      </Cartao>
    </>
  )
}

function PreviaTxt({ texto }: { texto: string }) {
  const linhas = texto.split('\r\n').filter(Boolean)
  if (!linhas.length) return <p className="px-5 py-8 text-center text-sm text-suave">Nenhum lançamento para exportar.</p>
  return (
    <pre className="max-h-[340px] overflow-auto px-5 py-4 text-xs leading-relaxed">
      {linhas.map((linha, i) => (
        <div key={i}>
          <span className="mr-3 inline-block w-7 text-right text-apagado select-none">{i + 1}</span>
          {linha.replace(/\t/g, '→')}
        </div>
      ))}
    </pre>
  )
}
