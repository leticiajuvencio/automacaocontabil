import { LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/contexto'
import { cx } from './estilos'

const itens = [
  { para: '/', rotulo: 'Painel', fim: true },
  { para: '/empresas', rotulo: 'Empresas' },
  { para: '/dominio', rotulo: 'Domínio' },
  { para: '/usuarios', rotulo: 'Usuários', soAdmin: true },
]


export function Layout() {
  const { sessao, sair } = useAuth()
  const admin = sessao?.usuario.admin ?? false

  return (
    <div className="flex min-h-screen flex-col">

      <header className="border-b border-borda bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-7">
          <NavLink to="/" className="flex items-center gap-3">
            <img src="/img/logo-frasson.png" alt="Frasson Contabilidade" className="h-9 w-auto" />
            <span className="hidden text-sm font-semibold sm:block">Automação Contábil</span>
          </NavLink>

          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            {itens
              .filter((item) => !item.soAdmin || admin)
              .map(({ para, rotulo, fim }) => (
                <NavLink
                  key={para}
                  to={para}
                  end={fim}
                  className={({ isActive }) =>
                    cx(
                      'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                      isActive ? 'bg-marca-clara text-marca-escura' : 'text-suave hover:bg-linha hover:text-texto',
                    )
                  }
                >
                  {rotulo}
                </NavLink>
              ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <div className="text-right">
              <p className="text-sm leading-tight font-medium">{sessao?.usuario.nome}</p>
              <p className="text-xs text-apagado">{sessao?.usuario.email}</p>
            </div>
            <button onClick={sair} title="Sair" aria-label="Sair" className="rounded-md p-2 text-suave hover:bg-linha hover:text-texto">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-7">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-[1100px] px-4 pb-6 text-[11px] text-apagado sm:px-7">Contabilidade Frasson</footer>
    </div>
  )
}
