import { FileCode2, RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useConsultarEnvio, useEmpresas, useEnviarNotas, useEnviosDominio, useStatusDominio } from '../api/consultas'
import { Aviso, Botao, CabecalhoPagina, Carregando, Cartao, Etiqueta, Selecao, TituloCartao, Vazio } from '../components/ui'
import { cx } from '../components/estilos'
import { formatarDataHora, plural } from '../lib/formatar'

export function DominioPage() {
  const status = useStatusDominio()
  const empresas = useEmpresas()
  const envios = useEnviosDominio()
  const enviar = useEnviarNotas()
  const consultar = useConsultarEnvio()

  const [empresaId, setEmpresaId] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])

  const vinculadas = (empresas.data ?? []).filter((e) => e.dominio.ativo)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    try {
      await enviar.mutateAsync({ empresaId: Number(empresaId), arquivos })
      setArquivos([])
      toast.success('XML enviado. O Domínio processa e o status muda em seguida.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar.')
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Domínio" descricao="Integração com a API do Domínio (Onvio)" />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Cartao>
          <TituloCartao titulo="Conexão" />
          <div className="space-y-3 p-5 text-sm">
            {status.isPending ? (
              <Carregando />
            ) : status.isError ? (
              <Aviso tipo="erro">{status.error.message}</Aviso>
            ) : status.data.configurado ? (
              <>
                <p className="flex items-center gap-2">
                  <Etiqueta className="bg-ok-clara text-ok">configurada</Etiqueta>
                  <span className="text-suave">ambiente de {status.data.ambiente === 'producao' ? 'produção' : 'homologação'}</span>
                </p>
                <p className="text-suave">
                  {status.data.tokenGeradoEm ? `Token do dia gerado em ${formatarDataHora(status.data.tokenGeradoEm)}.` : 'O token do dia ainda não foi gerado.'}{' '}
                  {plural(status.data.empresasVinculadas, 'empresa vinculada', 'empresas vinculadas')}.
                </p>
              </>
            ) : (
              <Aviso tipo="alerta">
                O back-end ainda não tem o client ID e o client secret da Domínio. Eles são pedidos pelo cadastro “Integração online com
                qualquer ERP” no site da Domínio Sistemas.
              </Aviso>
            )}
            <p className="text-xs text-apagado">
              O client ID, o client secret e as chaves de integração ficam só no back-end. O token vale 24 horas e a Domínio pede para gerar
              um por dia.
            </p>
          </div>
        </Cartao>

        <Cartao>
          <TituloCartao titulo="O que vai pela API" />
          <div className="space-y-2 p-5 text-[13px] text-[#3d3d3a]">
            <p>
              A API do Domínio recebe <b>XML de documentos fiscais</b> (NF-e, NFC-e, CT-e, CF-e e NFS-e), que caem na Escrita Fiscal do
              escritório.
            </p>
            <p>
              Os <b>lançamentos dos extratos</b> não têm envio pela API: eles continuam indo pelo TXT, importado na Contabilidade em
              Utilitários › Importação › Importador.
            </p>
            <p className="text-suave">
              Para vincular uma empresa, abra o cadastro dela em <Link to="/empresas" className="font-medium text-marca-escura underline">Empresas</Link>{' '}
              e cole a chave gerada no Onvio.
            </p>
          </div>
        </Cartao>

        <Cartao className="lg:col-span-2">
          <TituloCartao titulo="Enviar notas (XML)" descricao="Os arquivos vão em um lote para a empresa escolhida." />
          {vinculadas.length === 0 && !empresas.isPending ? (
            <p className="px-5 py-6 text-sm text-suave">Nenhuma empresa vinculada ao Domínio ainda.</p>
          ) : (
            <form onSubmit={aoEnviar} className="flex flex-wrap items-end gap-3 p-5">
              <div className="min-w-[220px] flex-1">
                <Selecao rotulo="Empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
                  <option value="" disabled>
                    Escolha a empresa
                  </option>
                  {vinculadas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razaoSocial}
                    </option>
                  ))}
                </Selecao>
              </div>
              <label className="flex h-10 min-w-[220px] flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#cfcfcb] bg-[#fbfbfa] px-3 text-sm text-suave hover:border-marca/60">
                <FileCode2 className="size-4 shrink-0" />
                <span className="truncate">{arquivos.length ? plural(arquivos.length, 'arquivo XML', 'arquivos XML') : 'Escolher XML'}</span>
                <input
                  type="file"
                  accept=".xml,application/xml,text/xml"
                  multiple
                  className="sr-only"
                  onChange={(e) => setArquivos([...(e.target.files ?? [])])}
                />
              </label>
              <Botao type="submit" disabled={!empresaId || !arquivos.length} carregando={enviar.isPending}>
                Enviar ao Domínio
              </Botao>
            </form>
          )}
        </Cartao>

        <Cartao className="overflow-hidden lg:col-span-2">
          <TituloCartao titulo="Envios" descricao="Cada envio é um lote na API. Consulte para atualizar o status." />
          {envios.isPending ? (
            <Carregando />
          ) : envios.isError ? (
            <div className="p-5">
              <Aviso tipo="erro">{envios.error.message}</Aviso>
            </div>
          ) : envios.data.length === 0 ? (
            <Vazio icone={<FileCode2 className="size-5" />} titulo="Nenhum envio ainda" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-linha text-left text-xs text-suave">
                    <th className="px-4 py-3 font-normal">enviado em</th>
                    <th className="px-4 py-3 font-normal">empresa</th>
                    <th className="px-4 py-3 font-normal">arquivos</th>
                    <th className="px-4 py-3 font-normal">status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {envios.data.map((envio) => {
                    const armazenado = /armazenado/i.test(envio.mensagem)
                    return (
                      <tr key={envio.id} className="border-b border-linha last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatarDataHora(envio.enviadoEm)}</td>
                        <td className="px-4 py-3">{envio.empresaNome}</td>
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate" title={envio.arquivos.join(', ')}>
                            {envio.arquivos.join(', ')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Etiqueta className={armazenado ? 'bg-ok-clara text-ok' : 'bg-alerta-clara text-alerta'}>{envio.mensagem}</Etiqueta>
                          {envio.consultadoEm && <p className="mt-1 text-xs text-apagado">consultado {formatarDataHora(envio.consultadoEm)}</p>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Botao
                            variante="secundario"
                            pequeno
                            icone={<RefreshCw className={cx('size-3.5', consultar.isPending && consultar.variables === envio.id && 'animate-spin')} />}
                            onClick={() => consultar.mutate(envio.id)}
                            disabled={consultar.isPending}
                          >
                            Consultar
                          </Botao>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </div>
    </>
  )
}
