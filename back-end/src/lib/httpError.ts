// Erro com código HTTP. Ex.: throw new HttpError(404, 'Empresa não encontrada.')
export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
