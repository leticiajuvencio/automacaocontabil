-- Sugestão de alterações no banco_frasson.sql para atender o front novo.
-- É só uma proposta para a Camila (DBA) revisar: os nomes seguem o padrão das tabelas que já existem.

-- Usuários: quem é administrador pode cadastrar outros usuários
ALTER TABLE usuarios_sistema ADD COLUMN admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Empresas: dados da configuração (antes ficavam no navegador, no site de referência)
ALTER TABLE empresas_clientes
    ADD COLUMN codigo_dominio VARCHAR(20),
    ADD COLUMN conta_entrada VARCHAR(20),
    ADD COLUMN historico_entrada VARCHAR(20),
    ADD COLUMN conta_saida VARCHAR(20),
    ADD COLUMN historico_saida VARCHAR(20),
    ADD COLUMN rende_facil VARCHAR(15) NOT NULL DEFAULT 'ignorar',
    ADD COLUMN conta_aplicacao VARCHAR(20),
    ADD COLUMN opcoes_arquivo JSONB,
    -- vínculo com a API do Domínio (a integration key nunca vai para o front)
    ADD COLUMN dominio_integration_key TEXT,
    ADD COLUMN dominio_escritorio VARCHAR(150),
    ADD COLUMN dominio_nome VARCHAR(150),
    ADD COLUMN dominio_cnpj VARCHAR(18),
    ADD COLUMN dominio_ativado_em TIMESTAMP;

-- A empresa pode ser criada a partir do PDF, e alguns extratos não trazem o CNPJ.
-- Se for o caso, liberar o NULL (o UNIQUE continua valendo para quem tem CNPJ):
-- ALTER TABLE empresas_clientes ALTER COLUMN cnpj DROP NOT NULL;

CREATE TABLE contas_bancarias (
    id_conta SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    banco VARCHAR(60),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    codigo_contabil VARCHAR(20),

    CONSTRAINT fk_conta_empresa
        FOREIGN KEY (id_empresa)
        REFERENCES empresas_clientes (id_empresa)
        ON DELETE CASCADE
);

CREATE TABLE regras_classificacao (
    id_regra SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    ordem INT NOT NULL,            -- vale a primeira regra que bater, então a ordem importa
    termo VARCHAR(100) NOT NULL,
    descricao VARCHAR(150),
    conta VARCHAR(20),
    historico VARCHAR(20),

    CONSTRAINT fk_regra_empresa
        FOREIGN KEY (id_empresa)
        REFERENCES empresas_clientes (id_empresa)
        ON DELETE CASCADE
);

-- Extratos: o que o front leu do PDF
ALTER TABLE arquivos_processados
    ADD COLUMN competencia CHAR(7),        -- mm/aaaa
    ADD COLUMN banco VARCHAR(60),
    ADD COLUMN metodo VARCHAR(40),         -- Leitor BB, Leitura automática, PDF de imagem
    ADD COLUMN aviso TEXT,
    ADD COLUMN info JSONB,                 -- agência, conta, cliente e saldos lidos do PDF
    ADD COLUMN texto_pdf TEXT;

-- status usado pelo front: processando, revisao, concluido, erro

ALTER TABLE linhas_extrato
    ADD COLUMN detalhe TEXT,
    ADD COLUMN documento VARCHAR(40),
    ADD COLUMN origem_tipo VARCHAR(15),    -- extrato, saldo, secao, deduzido, manual
    ADD COLUMN incluir BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN contrapartida VARCHAR(20);

-- tipo: o front usa 'C' (entrada) e 'D' (saída)

-- Envios de XML para a API do Domínio
CREATE TABLE envios_dominio (
    id_envio VARCHAR(40) PRIMARY KEY,      -- id do lote devolvido pela API
    id_empresa INT NOT NULL,
    id_usuario INT NOT NULL,
    arquivos TEXT NOT NULL,                -- nomes dos XML
    enviado_em TIMESTAMP NOT NULL,
    mensagem TEXT,
    consultado_em TIMESTAMP,

    CONSTRAINT fk_envio_empresa
        FOREIGN KEY (id_empresa)
        REFERENCES empresas_clientes (id_empresa),

    CONSTRAINT fk_envio_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios_sistema (id_usuario)
);

-- Token do Domínio: a documentação pede para gerar só um por dia
CREATE TABLE token_dominio (
    id_token SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    gerado_em TIMESTAMP NOT NULL
);

CREATE INDEX idx_contas_empresa ON contas_bancarias (id_empresa);
CREATE INDEX idx_regras_empresa ON regras_classificacao (id_empresa);
CREATE INDEX idx_envios_empresa ON envios_dominio (id_empresa);
