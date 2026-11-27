// Dados de exemplo do modo demonstração (os mesmos nomes do protótipo no Figma).
// CNPJs e contas são fictícios.

import type { Empresa, EnvioDominio, Extrato, Lancamento, Usuario, VinculoDominio } from '../api/tipos'
import { empresaEmBranco } from '../contabil/padroes'

export interface BancoDemo {
  usuarios: (Usuario & { senha: string })[]
  empresas: Omit<Empresa, 'totalExtratos'>[]
  extratos: Omit<Extrato, 'empresaNome' | 'totalLinhas' | 'linhasRevisadas'>[]
  envios: EnvioDominio[]
  proximoId: number
}

const semVinculo: VinculoDominio = { ativo: false, escritorio: '', nomeNoDominio: '', cnpjNoDominio: '', ativadoEm: null }

function empresa(id: number, razaoSocial: string, cnpj: string, codigo: string, banco: string, agencia: string, conta: string, codigoConta: string) {
  const base = empresaEmBranco({
    razaoSocial,
    cnpj,
    codigoDominio: codigo,
    contaEntrada: '1501',
    historicoEntrada: '3',
    contaSaida: '2401',
    historicoSaida: '4',
    contas: [{ banco, agencia, conta, codigo: codigoConta }],
  })
  const contas: Record<string, string> = { TARIFA: '4210', DARF: '2185', 'SIMPLES NACIONAL': '2181', CONTABILIDADE: '4120', 'TRANSFERENCIA RECEBIDA': '1102', TED: '2110' }
  // "TED RECEBIDA" vem antes de "TED", senão a TED recebida cairia em fornecedores
  base.regras = [
    { termo: 'TED RECEBIDA', descricao: 'Recebimento de clientes', conta: '1102', historico: '' },
    ...base.regras.map((r) => ({ ...r, conta: contas[r.termo] ?? r.conta })),
  ]
  return { ...base, id, dominio: { ...semVinculo }, dataCadastro: '2026-08-01T12:00:00.000Z' }
}

let idLinha = 1
function linha(data: string, historico: string, detalhe: string, valor: number, tipo: 'C' | 'D', revisado = false, extra: Partial<Lancamento> = {}): Lancamento {
  return { id: idLinha++, data, historico, detalhe, documento: '', valor, tipo, origemTipo: 'extrato', revisado, incluir: true, contrapartida: '', ...extra }
}

const infoVazia = { banco: '', cliente: '', documento: '', agencia: '', conta: '', periodo: '', saldoAnterior: null, saldoFinal: null }

export function dadosIniciais(): BancoDemo {
  idLinha = 1
  const empresas = [
    empresa(1, 'Marimar Confecções', '12.345.678/0001-90', '101', 'Sicredi', '0718', '12345-6', '12'),
    empresa(2, 'Silva & Cia', '23.456.789/0001-01', '102', 'Banco do Brasil', '1234-5', '98765-4', '13'),
    empresa(3, 'Atacadão Sul', '34.567.890/0001-12', '103', 'Itaú', '0456', '55432-1', '14'),
    empresa(4, 'Móveis Boa Vista', '45.678.901/0001-23', '104', 'Sicredi', '0718', '33210-9', ''),
    empresa(5, 'Padaria Central', '56.789.012/0001-34', '105', 'Caixa', '2201', '00451-7', '15'),
  ]
  empresas[0].dominio = {
    ativo: true,
    escritorio: 'CONTABILIDADE FRASSON',
    nomeNoDominio: 'MARIMAR CONFECCOES',
    cnpjNoDominio: '12.345.678/0001-90',
    ativadoEm: '2026-10-20T14:10:00.000Z',
  }
  empresas[1].rendeFacil = 'ignorar'

  const usuario = 'Administrador'
  const extratos: BancoDemo['extratos'] = [
    {
      id: 1,
      empresaId: 1,
      nomeArquivo: 'extrato_marimar_08.pdf',
      banco: 'Sicredi',
      competencia: '08/2026',
      status: 'revisao',
      dataUpload: '2026-09-03T13:20:00.000Z',
      usuarioNome: usuario,
      metodo: 'Leitura automática',
      aviso: '',
      info: { ...infoVazia, banco: 'Sicredi', cliente: 'MARIMAR CONFECCOES', documento: '12.345.678/0001-90', agencia: '0718', conta: '12345-6', periodo: '01/08/2026 a 31/08/2026', saldoAnterior: 8420.15, saldoFinal: 8952.33 },
      textoPdf: 'SICREDI · Extrato de conta corrente\nAssociado: MARIMAR CONFECCOES  CNPJ 12.345.678/0001-90\nCooperativa: 0718  Conta: 12345-6\n(texto de exemplo do modo demonstração)',
      lancamentos: [
        linha('02/08/2026', 'TED recebida', 'cliente 1042', 1200, 'C', true),
        linha('04/08/2026', 'Pagamento fornecedor', 'nota 8871', 640, 'D', true),
        linha('05/08/2026', 'Tarifa bancária', '', 29.9, 'D'),
        linha('09/08/2026', 'Depósito em dinheiro', '', 850, 'C'),
        linha('11/08/2026', 'PIX enviado', 'aluguel', 2100, 'D'),
        linha('12/08/2026', 'PIX recebido', 'Loja Centro', 3480, 'C'),
        linha('15/08/2026', 'DARF', 'IRPJ', 412.37, 'D', false, { documento: '7781203' }),
        linha('18/08/2026', 'Simples Nacional', 'DAS 07/2026', 1236.55, 'D'),
        linha('22/08/2026', 'Contabilidade Frasson', 'honorários', 650, 'D'),
        linha('25/08/2026', 'TED recebida', 'cliente 1077', 2050, 'C'),
        linha('28/08/2026', 'Boleto pago', 'energia elétrica', 389.4, 'D', false, { origemTipo: 'deduzido' }),
      ],
    },
    {
      id: 2,
      empresaId: 2,
      nomeArquivo: 'extrato_silva_08.pdf',
      banco: 'Banco do Brasil',
      competencia: '08/2026',
      status: 'concluido',
      dataUpload: '2026-09-02T18:05:00.000Z',
      usuarioNome: usuario,
      metodo: 'Leitor BB',
      aviso: '',
      info: { ...infoVazia, banco: 'Banco do Brasil', cliente: 'SILVA & CIA', agencia: '1234-5', conta: '98765-4', saldoAnterior: 15210, saldoFinal: 14532.6 },
      textoPdf: 'Extrato de Conta Corrente\nCliente SILVA & CIA  Agência: 1234-5  Conta: 98765-4\n(texto de exemplo do modo demonstração)',
      lancamentos: [
        linha('03/08/2026', 'Transferência recebida', 'Mercado Bom Preço', 4200, 'C', true),
        linha('06/08/2026', 'Pagamento de boleto', 'Distribuidora Sul', 1870.4, 'D', true),
        linha('10/08/2026', 'BB Rende Fácil', 'aplicação automática', 1500, 'D', true),
        linha('14/08/2026', 'Tarifa pacote de serviços', '', 54, 'D', true),
        linha('20/08/2026', 'TED', 'folha de pagamento', 3453, 'D', true),
      ],
    },
    {
      id: 3,
      empresaId: 3,
      nomeArquivo: 'extrato_atacadao_08.pdf',
      banco: 'Itaú',
      competencia: '08/2026',
      status: 'processando',
      dataUpload: '2026-09-04T11:42:00.000Z',
      usuarioNome: usuario,
      metodo: '',
      aviso: '',
      info: { ...infoVazia, banco: 'Itaú' },
      textoPdf: '',
      lancamentos: [],
    },
    {
      id: 4,
      empresaId: 4,
      nomeArquivo: 'extrato_moveis_08.pdf',
      banco: 'Sicredi',
      competencia: '08/2026',
      status: 'erro',
      dataUpload: '2026-09-04T09:15:00.000Z',
      usuarioNome: usuario,
      metodo: 'PDF de imagem',
      aviso: 'Este PDF é uma imagem, sem texto. Inclua os lançamentos à mão na revisão.',
      info: { ...infoVazia, banco: 'Sicredi' },
      textoPdf: '',
      lancamentos: [],
    },
    {
      id: 5,
      empresaId: 5,
      nomeArquivo: 'extrato_padaria_07.pdf',
      banco: 'Caixa',
      competencia: '07/2026',
      status: 'concluido',
      dataUpload: '2026-08-05T16:30:00.000Z',
      usuarioNome: usuario,
      metodo: 'Leitura automática',
      aviso: '',
      info: { ...infoVazia, banco: 'Caixa Econômica Federal', agencia: '2201', conta: '00451-7' },
      textoPdf: '(texto de exemplo do modo demonstração)',
      lancamentos: [
        linha('01/07/2026', 'Depósito', 'vendas do fim de semana', 2310.5, 'C', true),
        linha('08/07/2026', 'Pagamento', 'Moinho Rio Grande', 980, 'D', true),
        linha('15/07/2026', 'Tarifa', 'manutenção de conta', 32.5, 'D', true),
      ],
    },
  ]

  return {
    usuarios: [
      { id: 1, nome: 'Administrador', email: 'admin@frasson.com.br', admin: true, senha: 'frasson', dataCadastro: '2026-08-01T12:00:00.000Z' },
      { id: 2, nome: 'Setor contábil', email: 'contabil@frasson.com.br', admin: false, senha: 'frasson', dataCadastro: '2026-08-02T12:00:00.000Z' },
    ],
    empresas,
    extratos,
    envios: [
      {
        id: '1099D9899A36411381D7142953850266',
        empresaId: 1,
        empresaNome: 'Marimar Confecções',
        arquivos: ['nfe_000123.xml', 'nfe_000124.xml'],
        enviadoEm: '2026-10-21T10:02:00.000Z',
        mensagem: 'Arquivo armazenado na API',
        consultadoEm: '2026-10-21T10:30:00.000Z',
      },
    ],
    proximoId: 100,
  }
}
