// Formatos que o front manda e recebe da API.

export interface Usuario {
  id: number
  nome: string
  email: string
  admin: boolean
  dataCadastro: string
}

export interface Sessao {
  token: string
  usuario: Usuario
}

// ---------- Empresas ----------

export interface ContaBancaria {
  banco: string
  agencia: string
  conta: string
  /** código reduzido da conta do banco no plano de contas do Domínio */
  codigo: string
}

/** Se a palavra-chave aparecer no histórico, o lançamento vai para a conta da regra. */
export interface Regra {
  termo: string
  descricao: string
  conta: string
  historico: string
}

export interface OpcoesArquivo {
  separador: ';' | '|' | 'tab'
  codificacao: 'ansi' | 'utf8'
  /** "cada" = 1 na coluna Inicia Lote em todas as linhas (cada lançamento é um lote) */
  iniciaLote: 'cada' | 'vazio'
  filial: string
  centroCustoDebito: string
  centroCustoCredito: string
  cabecalho: boolean
  semAcentos: boolean
  maiusculas: boolean
  documentoNoComplemento: boolean
  abaImportacao: boolean
  abaExtrato: boolean
  abaResumo: boolean
}

export interface VinculoDominio {
  ativo: boolean
  /** dados que a API do Domínio devolveu ao conferir a chave */
  escritorio: string
  nomeNoDominio: string
  cnpjNoDominio: string
  ativadoEm: string | null
}

export interface Empresa {
  id: number
  razaoSocial: string
  cnpj: string
  codigoDominio: string
  contaEntrada: string
  historicoEntrada: string
  contaSaida: string
  historicoSaida: string
  rendeFacil: 'ignorar' | 'contabilizar'
  contaAplicacao: string
  contas: ContaBancaria[]
  regras: Regra[]
  opcoes: OpcoesArquivo
  dominio: VinculoDominio
  totalExtratos: number
  dataCadastro: string
}

export type DadosEmpresa = Omit<Empresa, 'id' | 'dominio' | 'totalExtratos' | 'dataCadastro'>

// ---------- Extratos ----------

export type StatusExtrato = 'processando' | 'revisao' | 'concluido' | 'erro'

/** De onde veio o C/D do lançamento: do próprio PDF, da conta do saldo, da seção (entradas/saídas), deduzido pelo texto ou digitado */
export type OrigemTipo = 'extrato' | 'saldo' | 'secao' | 'deduzido' | 'manual'

export interface Lancamento {
  id: number
  /** dd/mm/aaaa */
  data: string
  historico: string
  detalhe: string
  documento: string
  /** sempre positivo; o sentido vem de `tipo` */
  valor: number
  /** C = entrada na conta, D = saída */
  tipo: 'C' | 'D'
  origemTipo: OrigemTipo
  revisado: boolean
  /** false = fica fora do TXT (ex.: aplicação automática) */
  incluir: boolean
  /** conta digitada na revisão; vazio = usa a regra */
  contrapartida: string
}

export type NovoLancamento = Omit<Lancamento, 'id'>

export interface InfoExtrato {
  banco: string
  cliente: string
  documento: string
  agencia: string
  conta: string
  periodo: string
  saldoAnterior: number | null
  saldoFinal: number | null
}

export interface ExtratoResumo {
  id: number
  empresaId: number
  empresaNome: string
  nomeArquivo: string
  banco: string
  /** mm/aaaa */
  competencia: string
  status: StatusExtrato
  dataUpload: string
  usuarioNome: string
  totalLinhas: number
  linhasRevisadas: number
}

export interface Extrato extends ExtratoResumo {
  metodo: string
  aviso: string
  info: InfoExtrato
  /** texto que o PDF.js tirou do PDF, para conferência */
  textoPdf: string
  lancamentos: Lancamento[]
}

/** O que o front manda junto com o PDF depois de ler o arquivo. */
export interface DadosNovoExtrato {
  empresaId: number
  competencia: string
  banco: string
  metodo: string
  aviso: string
  info: InfoExtrato
  textoPdf: string
  lancamentos: NovoLancamento[]
}

// ---------- Domínio ----------

export interface StatusDominio {
  /** client_id e client_secret configurados no back-end */
  configurado: boolean
  ambiente: 'producao' | 'homologacao'
  /** quando o token do dia foi gerado (a Domínio pede 1 por dia) */
  tokenGeradoEm: string | null
  empresasVinculadas: number
}

/** Resposta do GET activation/info, já traduzida pelo back-end */
export interface ConferenciaChave {
  escritorio: string
  cliente: string
  cnpj: string
}

export interface EnvioDominio {
  /** id do lote devolvido pela API do Domínio */
  id: string
  empresaId: number
  empresaNome: string
  arquivos: string[]
  enviadoEm: string
  /** status.message do lote, ex.: "Arquivo armazenado na API" */
  mensagem: string
  consultadoEm: string | null
}
