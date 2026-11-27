import { twMerge } from 'tailwind-merge'
import type { StatusExtrato } from '../api/tipos'

/**
 * Junta classes do Tailwind, ignorando as condições falsas. O twMerge resolve conflitos:
 * cx('h-10 bg-campo', 'h-8 bg-white') vira 'h-8 bg-white' (a última vence).
 */
export function cx(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '))
}

export const estiloCampo =
  'h-10 rounded-lg border border-borda bg-campo px-3 text-sm text-texto placeholder:text-apagado ' +
  'focus:border-marca focus:bg-white focus:outline-none focus:ring-3 focus:ring-marca/15 disabled:opacity-60'

// cores das etiquetas de status, iguais às do Figma
export const estilosStatus: Record<StatusExtrato, { rotulo: string; classe: string }> = {
  processando: { rotulo: 'processando', classe: 'bg-marca-clara text-marca-escura' },
  revisao: { rotulo: 'em revisão', classe: 'bg-alerta-clara text-alerta' },
  concluido: { rotulo: 'concluído', classe: 'bg-ok-clara text-ok' },
  erro: { rotulo: 'erro', classe: 'bg-erro-clara text-erro' },
}
