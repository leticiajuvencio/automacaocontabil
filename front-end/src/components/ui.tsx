import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import type { StatusExtrato } from '../api/tipos'
import { cx, estiloCampo, estilosStatus } from './estilos'

// ---------- Botão ----------

type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const estilosBotao: Record<VarianteBotao, string> = {
  primario: 'bg-marca text-white hover:bg-[#d95c1c]',
  secundario: 'bg-white text-texto border border-borda hover:bg-campo',
  fantasma: 'text-suave hover:bg-linha hover:text-texto',
  perigo: 'bg-white text-erro border border-erro-clara hover:bg-erro-clara',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  carregando?: boolean
  icone?: ReactNode
  pequeno?: boolean
}

export function Botao({
  variante = 'primario',
  carregando = false,
  icone,
  pequeno = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: BotaoProps) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca',
        'disabled:cursor-not-allowed disabled:opacity-50',
        pequeno ? 'h-7 rounded-md px-2.5 text-[13px] font-medium' : 'h-10 rounded-lg px-4 text-sm',
        estilosBotao[variante],
        className,
      )}
      {...props}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" /> : icone}
      {children}
    </button>
  )
}

// ---------- Campos ----------

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  ajuda?: ReactNode
}

export function Campo({ rotulo, ajuda, id, className, ...props }: CampoProps) {
  const campoId = id ?? props.name
  return (
    <label htmlFor={campoId} className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-suave">{rotulo}</span>
      <input id={campoId} className={cx(estiloCampo, 'w-full', className)} {...props} />
      {ajuda && <span className="mt-1 block text-xs text-apagado">{ajuda}</span>}
    </label>
  )
}

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo?: string
}

export function Selecao({ rotulo, id, className, children, ...props }: SelecaoProps) {
  const select = (
    <select id={id ?? props.name} className={cx(estiloCampo, rotulo && 'w-full', 'pr-8', className)} {...props}>
      {children}
    </select>
  )
  if (!rotulo) return select
  return (
    <label htmlFor={id ?? props.name} className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-suave">{rotulo}</span>
      {select}
    </label>
  )
}

export function Marcador({ rotulo, ...props }: InputHTMLAttributes<HTMLInputElement> & { rotulo: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-ok-forte" {...props} />
      {rotulo}
    </label>
  )
}

// ---------- Estrutura ----------

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-[14px] border border-borda bg-white', className)}>{children}</div>
}

export function TituloCartao({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linha px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-[13px] text-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[36px] leading-tight font-semibold">{titulo}</h1>
        {descricao && <p className="text-lg font-semibold">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

/** Cartão com um número grande, como "total 42" no painel. */
export function CartaoNumero({ rotulo, valor, cor = 'text-texto' }: { rotulo: string; valor: ReactNode; cor?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-white px-4 py-3.5">
      <span className="block text-[13px] text-suave">{rotulo}</span>
      <span className={cx('mt-1.5 block text-[22px] font-semibold tabular-nums', cor)}>{valor}</span>
    </div>
  )
}

// ---------- Etiquetas ----------

export function Etiqueta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full bg-linha px-2.5 py-0.5 text-xs whitespace-nowrap text-[#555553]', className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: StatusExtrato }) {
  const { rotulo, classe } = estilosStatus[status]
  return <Etiqueta className={classe}>{rotulo}</Etiqueta>
}

// ---------- Feedback ----------

type TipoAviso = 'info' | 'sucesso' | 'alerta' | 'erro'

const estilosAviso: Record<TipoAviso, { caixa: string; icone: ReactNode }> = {
  info: { caixa: 'bg-marca-fundo text-[#7c2d12]', icone: <Info className="size-4 text-marca" /> },
  sucesso: { caixa: 'bg-ok-clara text-ok', icone: <CheckCircle2 className="size-4" /> },
  alerta: { caixa: 'bg-alerta-clara text-alerta', icone: <AlertTriangle className="size-4" /> },
  erro: { caixa: 'bg-erro-clara text-erro', icone: <XCircle className="size-4" /> },
}

export function Aviso({ tipo = 'info', children, acoes }: { tipo?: TipoAviso; children: ReactNode; acoes?: ReactNode }) {
  const estilo = estilosAviso[tipo]
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3.5 py-2.5 text-[13px]', estilo.caixa)}>
      <span className="shrink-0">{estilo.icone}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-suave">
      <Loader2 className="size-4 animate-spin" />
      {texto}
    </div>
  )
}

export function Vazio({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-marca-clara text-marca">{icone}</div>
      <p className="font-medium">{titulo}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-suave">{children}</div>}
    </div>
  )
}

// ---------- Modal ----------

export function Modal({
  aberto,
  aoFechar,
  titulo,
  rotulo,
  descricao,
  largura = 'max-w-lg',
  children,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo?: string
  /** nome lido pelo leitor de tela quando o modal não tem título visível */
  rotulo?: string
  descricao?: string
  largura?: string
  children: ReactNode
}) {
  // fecha com Esc
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onMouseDown={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo ?? rotulo}
        className={cx('relative my-auto w-full rounded-[24px] bg-fundo p-6 shadow-xl sm:p-10', largura)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="absolute top-4 right-4 rounded-md p-1.5 text-suave hover:bg-linha">
          <X className="size-4" />
        </button>
        {titulo && (
          <div className="mb-5">
            <h2 className="text-lg font-semibold">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-suave">{descricao}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
