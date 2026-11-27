-- CreateTable
CREATE TABLE "token_dominio" (
    "id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "gerado_em" TIMESTAMP(6) NOT NULL,
    "expira_em" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "token_dominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envios_dominio" (
    "id" VARCHAR(40) NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "arquivos" TEXT[],
    "enviado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mensagem" TEXT NOT NULL,
    "consultado_em" TIMESTAMP(6),

    CONSTRAINT "envios_dominio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envios_dominio_id_empresa_idx" ON "envios_dominio"("id_empresa");

-- AddForeignKey
ALTER TABLE "envios_dominio" ADD CONSTRAINT "envios_dominio_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas_clientes"("id_empresa") ON DELETE CASCADE ON UPDATE CASCADE;
