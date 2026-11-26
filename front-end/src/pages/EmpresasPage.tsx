import { Building2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useEmpresas } from '../api/consultas'
import { Aviso, Botao, CabecalhoPagina, Carregando, Cartao, Etiqueta, Vazio } from '../components/ui'
import { iniciais, plural } from '../lib/formatar'

export function EmpresasPage() {
  const navigate = useNavigate()
  const empresas = useEmpresas()
  const lista = empresas.data ?? []

  return (
    <>
      <CabecalhoPagina
        titulo="Empresas"
        descricao="Clientes do escritório"
        acoes={
          <Botao onClick={() => navigate('/empresas/nova')} className="h-[38px]">
            + Nova empresa
          </Botao>
        }
      />


      <Cartao className="overflow-hidden">
        {empresas.isPending ? (
          <Carregando />
        ) : empresas.isError ? (
          <div className="p-5">
            <Aviso tipo="erro">{empresas.error.message}</Aviso>
          </div>
        ) : lista.length === 0 ? (
          <Vazio icone={<Building2 className="size-5" />} titulo="Nenhuma empresa cadastrada">
            Cadastre aqui ou envie um extrato: a empresa pode ser criada com os dados do PDF.
          </Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-xs text-suave">
                  <th className="px-4 py-3 font-normal">empresa</th>
                  <th className="px-4 py-3 font-normal">cód. Domínio</th>
                  <th className="px-4 py-3 font-normal">contas</th>
                  <th className="px-4 py-3 font-normal">API Domínio</th>
                  <th className="px-4 py-3 font-normal">extratos</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => {
                  const semCodigo = e.contas.filter((c) => !c.codigo).length
                  return (
                    <tr key={e.id} className="border-b border-linha last:border-0 hover:bg-campo">
                      <td className="px-4 py-3">
                        <Link to={`/empresas/${e.id}`} className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linha text-[11px] font-semibold text-suave">
                            {iniciais(e.razaoSocial)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium hover:underline">{e.razaoSocial}</span>
                            <span className="block text-xs text-apagado tabular-nums">{e.cnpj || 'sem CNPJ'}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{e.codigoDominio || <span className="text-apagado">—</span>}</td>
                      <td className="px-4 py-3">
                        {plural(e.contas.length, 'conta', 'contas')}
                        {semCodigo > 0 && <p className="text-xs text-alerta">{plural(semCodigo, 'sem código', 'sem código')}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {e.dominio.ativo ? <Etiqueta className="bg-ok-clara text-ok">vinculada</Etiqueta> : <Etiqueta>não vinculada</Etiqueta>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{e.totalExtratos}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  )
}
