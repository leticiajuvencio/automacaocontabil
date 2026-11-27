import type { DadosEmpresa, Empresa, OpcoesArquivo, Regra } from '../api/tipos'

export const OPCOES_PADRAO: OpcoesArquivo = {
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

// Regras que já vêm na empresa nova; falta só preencher a conta de cada uma.
export const REGRAS_PADRAO: Regra[] = [
  { termo: 'SIMPLES NACIONAL', descricao: 'Simples Nacional a recolher', conta: '', historico: '' },
  { termo: 'DARF', descricao: 'Tributos federais a recolher', conta: '', historico: '' },
  { termo: 'CONTABILIDADE', descricao: 'Honorários contábeis', conta: '', historico: '' },
  { termo: 'TARIFA', descricao: 'Despesas bancárias', conta: '', historico: '' },
  { termo: 'TRANSFERENCIA RECEBIDA', descricao: 'Recebimento de clientes', conta: '', historico: '' },
  { termo: 'TED', descricao: 'Pagamento a fornecedores / terceiros', conta: '', historico: '' },
]

export function empresaEmBranco(dados: Partial<DadosEmpresa> = {}): DadosEmpresa {
  return {
    razaoSocial: '',
    cnpj: '',
    codigoDominio: '',
    contaEntrada: '',
    historicoEntrada: '',
    contaSaida: '',
    historicoSaida: '',
    rendeFacil: 'ignorar',
    contaAplicacao: '',
    contas: [],
    regras: REGRAS_PADRAO.map((r) => ({ ...r })),
    opcoes: { ...OPCOES_PADRAO },
    ...dados,
  }
}

/** Tira da empresa os campos que a API calcula sozinha, para mandar no PUT. */
export function dadosDaEmpresa(empresa: Empresa): DadosEmpresa {
  const { id: _id, dominio: _dominio, totalExtratos: _total, dataCadastro: _data, ...dados } = empresa
  return dados
}
