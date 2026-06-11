-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "local" TEXT,
    "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "custo" REAL,
    "dataAbertura" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPrevista" DATETIME,
    "dataConclusao" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fornecedorId" TEXT,
    "responsavelId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "OrdemServico_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrdemServico_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrdemServico_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubOrdemServico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "custo" REAL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluidaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ordemId" TEXT NOT NULL,
    CONSTRAINT "SubOrdemServico_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "OrdemServico" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_numero_key" ON "OrdemServico"("numero");
