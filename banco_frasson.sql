-- Banco de Dados - Contabilidade Frasson
-- SGBD: PostgreSQL
-- Modelo relacional

CREATE TABLE usuarios_sistema (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    data_cadastro TIMESTAMP NOT NULL
);

CREATE TABLE empresas_clientes (
    id_empresa SERIAL PRIMARY KEY,
    razao_social VARCHAR(150) NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    data_cadastro TIMESTAMP NOT NULL
);

CREATE TABLE arquivos_processados (
    id_arquivo SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_usuario INT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    data_upload TIMESTAMP NOT NULL,
    status VARCHAR(30) NOT NULL,
    caminho_arquivo TEXT NOT NULL,

    CONSTRAINT fk_arquivo_empresa
        FOREIGN KEY (id_empresa)
        REFERENCES empresas_clientes (id_empresa),

    CONSTRAINT fk_arquivo_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios_sistema (id_usuario)
);

CREATE TABLE linhas_extrato (
    id_linha SERIAL PRIMARY KEY,
    id_arquivo INT NOT NULL,
    data_movimento DATE NOT NULL,
    historico TEXT NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    revisado BOOLEAN DEFAULT FALSE,

    CONSTRAINT fk_linha_arquivo
        FOREIGN KEY (id_arquivo)
        REFERENCES arquivos_processados (id_arquivo)
);

-- Índices para as chaves estrangeiras
CREATE INDEX idx_arquivos_empresa
    ON arquivos_processados (id_empresa);

CREATE INDEX idx_arquivos_usuario
    ON arquivos_processados (id_usuario);

CREATE INDEX idx_linhas_arquivo
    ON linhas_extrato (id_arquivo);
