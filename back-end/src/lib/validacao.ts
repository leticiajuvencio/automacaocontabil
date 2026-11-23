import { z } from 'zod'

// Regras de validação usadas em mais de uma rota

// o :id da URL tem que ser um número
export const idParam = z.object({ id: z.coerce.number().int().positive('Id inválido.') })

// texto que pode vir vazio, com tamanho máximo igual ao da coluna no banco
export const texto = (max: number) => z.string().trim().max(max)
