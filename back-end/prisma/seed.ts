import bcrypt from 'bcryptjs'
import { prisma } from '../src/db.js'

// Dados para testar no computador (npm run db:seed). Não usar em produção!

// mesmas opções e regras que o front coloca numa empresa nova (src/contabil/padroes.ts do front)
const OPCOES_PADRAO = {
  separador: ';',
  codificacao: 'ansi',
  iniciaLote: 'cada',
  filial: '',
  centroCustoDebito: '',
  centroCustoCredito: '',
  cabecalho: false,
  semAcentos: true,
  maiusculas: true,
  documentoNoComplemento: false,
  abaImportacao: true,
  abaExtrato: true,
  abaResumo: true,
}

const REGRAS_EXEMPLO = [
  // "TED RECEBIDA" vem antes de "TED", senão a TED recebida cairia em fornecedores
  { termo: 'TED RECEBIDA', descricao: 'Recebimento de clientes', conta: '1102', historico: '' },
  { termo: 'SIMPLES NACIONAL', descricao: 'Simples Nacional a recolher', conta: '2181', historico: '' },
  { termo: 'DARF', descricao: 'Tributos federais a recolher', conta: '2185', historico: '' },
  { termo: 'CONTABILIDADE', descricao: 'Honorários contábeis', conta: '4120', historico: '' },
  { termo: 'TARIFA', descricao: 'Despesas bancárias', conta: '4210', historico: '' },
  { termo: 'TRANSFERENCIA RECEBIDA', descricao: 'Recebimento de clientes', conta: '1102', historico: '' },
  { termo: 'TED', descricao: 'Pagamento a fornecedores / terceiros', conta: '2110', historico: '' },
]

async function main() {
  // mesmo login do modo demonstração do front
  await prisma.usuarioSistema.upsert({
    where: { email: 'admin@frasson.com.br' },
    update: {},
    create: { nome: 'Administrador', email: 'admin@frasson.com.br', senha: await bcrypt.hash('frasson', 10), admin: true },
  })

  await prisma.empresaCliente.upsert({
    where: { cnpj: '12.345.678/0001-95' },
    update: {},
    create: {
      razaoSocial: 'Marimar Confecções',
      cnpj: '12.345.678/0001-95',
      codigoDominio: '101',
      contaEntrada: '1501',
      historicoEntrada: '3',
      contaSaida: '2401',
      historicoSaida: '4',
      opcoes: OPCOES_PADRAO,
      contas: { create: [{ banco: 'Sicredi', agencia: '0718', conta: '12345-6', codigo: '12' }] },
      regras: { create: REGRAS_EXEMPLO.map((regra, ordem) => ({ ...regra, ordem })) },
    },
  })

  console.log('Seed ok! Login: admin@frasson.com.br / frasson')
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
