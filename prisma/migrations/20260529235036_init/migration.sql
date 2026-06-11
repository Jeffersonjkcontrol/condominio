-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'USUARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpjCpf" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "observacoes" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valorPadrao" REAL,
    "unidade" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fornecedorId" TEXT NOT NULL,
    CONSTRAINT "Servico_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" REAL NOT NULL,
    "dataEmissao" DATETIME NOT NULL,
    "arquivoUrl" TEXT,
    "textoExtraido" TEXT,
    "dadosExtraidos" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fornecedorId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "Recibo_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recibo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "orcamento" REAL,
    "dataInicioPrev" DATETIME NOT NULL,
    "dataFimPrev" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANEJADA',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsavelId" TEXT,
    CONSTRAINT "Obra_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EtapaObra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "inicioPrev" DATETIME NOT NULL,
    "fimPrev" DATETIME NOT NULL,
    "inicioReal" DATETIME,
    "fimReal" DATETIME,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "obraId" TEXT NOT NULL,
    CONSTRAINT "EtapaObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
