import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'
import { env } from './env.js'

// Conexão com o PostgreSQL. O back inteiro usa este "prisma" para falar com o banco.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
