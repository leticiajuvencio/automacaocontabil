import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link, useMatch, useNavigate } from 'react-router'
import { useEmpresas, useExtratos } from '../api/consultas'
import type { StatusExtrato } from '../api/tipos'
import { Aviso, Botao, CabecalhoPagina, Carregando, Cartao, CartaoNumero, Etiqueta, StatusBadge, Vazio } from '../components/ui'
import { cx } from '../components/estilos'
import { NovoUpload } from './NovoUpload'
import { RevisaoModal } from './RevisaoPage'

const estiloFiltro =
  'h-[22px] cursor-pointer appearance-none rounded-full border-0 px-2.5 text-xs focus:outline-2 focus:outline-marca'

export function PainelPage() {
  const navigate = useNavigate()
  const revisao = useMatch('/extratos/:id')
  const extratos = useExtratos({})
  const empresas = useEmpresas()
  const [empresaId, setEmpresaId] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [enviando, setEnviando] = useState(false)

  const lista = extratos.data ?? []

  // competências que existem nos extratos, da mais nova para a mais antiga
  const competencias = [...new Set(lista.map((e) => e.competencia))].sort(
    (a, b) => b.slice(3).localeCompare(a.slice(3)) || b.localeCompare(a),
  )

  const filtrados = lista.filter(
    (e) => (!empresaId || e.empresaId === Number(empresaId)) && (!competencia || e.competencia === competencia),
  )
  const contar = (s: StatusExtrato) => filtrados.filter((e) => e.status === s).length

  return (
    <>
      <CabecalhoPagina
        titulo="Painel"
        descricao="Arquivos processados"
        acoes={
          <Botao onClick={() => setEnviando(true)} className="h-[38px]">
            + Novo upload
          </Botao>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CartaoNumero rotulo="total" valor={filtrados.length} />
        <CartaoNumero rotulo="processando" valor={contar('processando')} cor="text-marca-escura" />
        <CartaoNumero rotulo="em revisão" valor={contar('revisao')} cor="text-alerta" />
        <CartaoNumero rotulo="concluídos" valor={contar('concluido')} cor="text-ok" />
      </div>

      <div className="mt-5 mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Empresa"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className={cx(estiloFiltro, 'bg-marca-clara text-marca-escura')}
        >
          <option value="">Todas as empresas</option>
          {empresas.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razaoSocial}
            </option>
          ))}
        </select>
        <select
          aria-label="Competência"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className={cx(estiloFiltro, 'bg-[#ececea] text-[#555553]')}
        >
          <option value="">Todas as competências</option>
          {competencias.map((c) => (
            <option key={c} value={c}>
              Competência {c}
            </option>
          ))}
        </select>
      </div>

      <Cartao className="overflow-hidden">
        {extratos.isPending ? (
          <Carregando />
        ) : extratos.isError ? (
          <div className="p-5">
            <Aviso tipo="erro">{extratos.error.message}</Aviso>
          </div>
        ) : filtrados.length === 0 ? (
          <Vazio icone={<FileText className="size-5" />} titulo={lista.length ? 'Nenhum arquivo nessa empresa ou competência' : 'Nenhum extrato enviado ainda'}>
            {!lista.length && 'Clique em "+ Novo upload" e envie o PDF do extrato.'}
          </Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-xs text-suave">
                  <th className="px-4 py-3 font-normal">arquivo</th>
                  <th className="px-4 py-3 font-normal">empresa</th>
                  <th className="px-4 py-3 font-normal">competência</th>
                  <th className="px-4 py-3 font-normal">status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={e.id} className="border-b border-linha last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.nomeArquivo}</p>
                      {e.banco && <Etiqueta className="mt-1">{e.banco}</Etiqueta>}
                    </td>
                    <td className="px-4 py-3 text-[#3d3d3a]">{e.empresaNome}</td>
                    <td className="px-4 py-3 text-[#3d3d3a] tabular-nums">{e.competencia}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3">
                      {e.status === 'processando' ? (
                        <span className="text-apagado">—</span>
                      ) : e.status === 'concluido' ? (
                        <BotaoLink para={`/extratos/${e.id}/exportar`}>Ver TXT</BotaoLink>
                      ) : (
                        <BotaoLink para={`/extratos/${e.id}`}>Revisar</BotaoLink>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <NovoUpload aberto={enviando} aoFechar={() => setEnviando(false)} />
      {revisao && <RevisaoModal id={Number(revisao.params.id)} aoFechar={() => navigate('/')} />}
    </>
  )
}

function BotaoLink({ para, children }: { para: string; children: string }) {
  return (
    <Link to={para} className="inline-flex h-7 items-center rounded-md border border-borda bg-white px-2.5 text-[13px] font-medium hover:bg-campo">
      {children}
    </Link>
  )
}
