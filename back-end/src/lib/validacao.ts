import { z } from 'zod'

// Regras de validação usadas em mais de uma rota

// id de tabela: número inteiro que cabe na coluna INT do PostgreSQL
export const idBanco = z.coerce.number().int().positive('Id inválido.').max(2_147_483_647, 'Id inválido.')

// o :id da URL
export const idParam = z.object({ id: idBanco })

// texto que pode vir vazio, com tamanho máximo igual ao da coluna no banco
export const texto = (max: number) => z.string().trim().max(max)
