import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAtivarDominio, useConferirChave, useDesvincularDominio } from '../api/consultas'
import type { Empresa } from '../api/tipos'
import { formatarDataHora, somenteDigitos } from '../lib/formatar'
import { Aviso, Botao, Campo, Cartao, TituloCartao } from './ui'

// Fluxo da API do Domínio (Onvio): a chave que o escritório gera para a empresa é conferida
// (activation/info) e depois trocada pela integrationKey (activation/enable). Quem fala com a
// API é o back-end; a integrationKey nunca chega ao navegador.
export function VinculoDominio({ empresa }: { empresa: Empresa }) {
  const conferir = useConferirChave(empresa.id)
  const ativar = useAtivarDominio(empresa.id)
  const desvincular = useDesvincularDominio(empresa.id)
  const [chave, setChave] = useState('')

  const { dominio } = empresa
  const conferida = conferir.data
  const cnpjDiferente = conferida && empresa.cnpj && somenteDigitos(conferida.cnpj) !== somenteDigitos(empresa.cnpj)

  async function ativarIntegracao() {
    try {
      await ativar.mutateAsync(chave.trim())
      setChave('')
      conferir.reset()
      toast.success('Empresa vinculada ao Domínio.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível ativar.')
    }
  }

  return (
    <Cartao>
      <TituloCartao titulo="Integração com o Domínio" descricao="Liga esta empresa à API do Domínio (Onvio) para enviar as notas em XML." />
      <div className="space-y-4 p-5">
        {dominio.ativo ? (
          <>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok-forte" />
              <div className="text-sm">
                <p className="font-medium">Vinculada como “{dominio.nomeNoDominio}”</p>
                <p className="text-suave">
                  CNPJ {dominio.cnpjNoDominio} · escritório {dominio.escritorio}
                  {dominio.ativadoEm && ` · desde ${formatarDataHora(dominio.ativadoEm)}`}
                </p>
              </div>
            </div>
            <Botao variante="perigo" pequeno onClick={() => desvincular.mutate()} carregando={desvincular.isPending}>
              Desvincular
            </Botao>
          </>
        ) : (
          <>
            <p className="text-[13px] text-suave">
              No Onvio Gestão, menu <b>API › Chave › Nova habilitação</b>, gere a chave desta empresa e cole aqui. A chave é uma por CNPJ e não
              vence.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <Campo
                  rotulo="Chave da empresa no Onvio"
                  value={chave}
                  onChange={(e) => {
                    setChave(e.target.value)
                    conferir.reset()
                  }}
                  autoComplete="off"
                />
              </div>
              <Botao variante="secundario" onClick={() => conferir.mutate(chave.trim())} disabled={!chave.trim()} carregando={conferir.isPending}>
                Conferir chave
              </Botao>
            </div>

            {conferir.isError && <Aviso tipo="erro">{conferir.error.message}</Aviso>}

            {conferida && (
              <div className="rounded-lg border border-borda bg-campo p-4 text-sm">
                <p className="mb-2 text-xs font-medium text-suave">O Domínio respondeu:</p>
                <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
                  <dt className="text-suave">Escritório</dt>
                  <dd>{conferida.escritorio}</dd>
                  <dt className="text-suave">Cliente</dt>
                  <dd>{conferida.cliente}</dd>
                  <dt className="text-suave">CNPJ</dt>
                  <dd className="tabular-nums">{conferida.cnpj}</dd>
                </dl>
                {cnpjDiferente && (
                  <div className="mt-3">
                    <Aviso tipo="alerta">O CNPJ da chave é diferente do CNPJ cadastrado aqui ({empresa.cnpj}). Confira antes de ativar.</Aviso>
                  </div>
                )}
                <Botao className="mt-3" onClick={ativarIntegracao} carregando={ativar.isPending}>
                  Ativar integração
                </Botao>
              </div>
            )}
          </>
        )}
      </div>
    </Cartao>
  )
}
