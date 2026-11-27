-- CreateTable
CREATE TABLE "usuarios_sistema" (
    "id_usuario" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "data_cadastro" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usuarios_sistema_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "empresas_clientes" (
    "id_empresa" SERIAL NOT NULL,
    "razao_social" VARCHAR(150) NOT NULL,
    "cnpj" VARCHAR(18),
    "data_cadastro" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo_dominio" VARCHAR(20) NOT NULL DEFAULT '',
    "conta_entrada" VARCHAR(20) NOT NULL DEFAULT '',
    "historico_entrada" VARCHAR(20) NOT NULL DEFAULT '',
    "conta_saida" VARCHAR(20) NOT NULL DEFAULT '',
    "historico_saida" VARCHAR(20) NOT NULL DEFAULT '',
    "rende_facil" VARCHAR(20) NOT NULL DEFAULT 'ignorar',
    "conta_aplicacao" VARCHAR(20) NOT NULL DEFAULT '',
    "opcoes" JSONB NOT NULL DEFAULT '{}',
    "dominio_chave" VARCHAR(100),
    "dominio_escritorio" VARCHAR(150) NOT NULL DEFAULT '',
    "dominio_nome" VARCHAR(150) NOT NULL DEFAULT '',
    "dominio_cnpj" VARCHAR(18) NOT NULL DEFAULT '',
    "dominio_ativado_em" TIMESTAMP(6),

    CONSTRAINT "empresas_clientes_pkey" PRIMARY KEY ("id_empresa")
);

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id_conta" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "banco" VARCHAR(60) NOT NULL,
    "agencia" VARCHAR(20) NOT NULL,
    "conta" VARCHAR(30) NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id_conta")
);

-- CreateTable
CREATE TABLE "regras_empresa" (
    "id_regra" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "termo" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(150) NOT NULL,
    "conta" VARCHAR(20) NOT NULL,
    "historico" VARCHAR(20) NOT NULL,

    CONSTRAINT "regras_empresa_pkey" PRIMARY KEY ("id_regra")
);

-- CreateTable
CREATE TABLE "arquivos_processados" (
    "id_arquivo" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "data_upload" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(30) NOT NULL,
    "caminho_arquivo" TEXT NOT NULL,
    "competencia" VARCHAR(7) NOT NULL,
    "banco" VARCHAR(60) NOT NULL DEFAULT '',
    "metodo" VARCHAR(100) NOT NULL DEFAULT '',
    "aviso" TEXT NOT NULL DEFAULT '',
    "info" JSONB NOT NULL DEFAULT '{}',
    "texto_pdf" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "arquivos_processados_pkey" PRIMARY KEY ("id_arquivo")
);

-- CreateTable
CREATE TABLE "linhas_extrato" (
    "id_linha" SERIAL NOT NULL,
    "id_arquivo" INTEGER NOT NULL,
    "data_movimento" DATE NOT NULL,
    "historico" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "documento" VARCHAR(60) NOT NULL DEFAULT '',
    "origem_tipo" VARCHAR(20) NOT NULL DEFAULT 'extrato',
    "incluir" BOOLEAN NOT NULL DEFAULT true,
    "contrapartida" VARCHAR(20) NOT NULL DEFAULT '',

    CONSTRAINT "linhas_extrato_pkey" PRIMARY KEY ("id_linha")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sistema_email_key" ON "usuarios_sistema"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_clientes_cnpj_key" ON "empresas_clientes"("cnpj");

-- CreateIndex
CREATE INDEX "contas_bancarias_id_empresa_idx" ON "contas_bancarias"("id_empresa");

-- CreateIndex
CREATE INDEX "regras_empresa_id_empresa_idx" ON "regras_empresa"("id_empresa");

-- CreateIndex
CREATE INDEX "arquivos_processados_id_empresa_idx" ON "arquivos_processados"("id_empresa");

-- CreateIndex
CREATE INDEX "arquivos_processados_id_usuario_idx" ON "arquivos_processados"("id_usuario");

-- CreateIndex
CREATE INDEX "linhas_extrato_id_arquivo_idx" ON "linhas_extrato"("id_arquivo");

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas_clientes"("id_empresa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_empresa" ADD CONSTRAINT "regras_empresa_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas_clientes"("id_empresa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos_processados" ADD CONSTRAINT "arquivos_processados_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas_clientes"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos_processados" ADD CONSTRAINT "arquivos_processados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios_sistema"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linhas_extrato" ADD CONSTRAINT "linhas_extrato_id_arquivo_fkey" FOREIGN KEY ("id_arquivo") REFERENCES "arquivos_processados"("id_arquivo") ON DELETE CASCADE ON UPDATE CASCADE;
