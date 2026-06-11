-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT,
    "usuarioNome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhe" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrdemServico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Geral',
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
INSERT INTO "new_OrdemServico" ("criadoEm", "criadoPorId", "custo", "dataAbertura", "dataConclusao", "dataPrevista", "descricao", "fornecedorId", "id", "local", "numero", "prioridade", "responsavelId", "status", "titulo") SELECT "criadoEm", "criadoPorId", "custo", "dataAbertura", "dataConclusao", "dataPrevista", "descricao", "fornecedorId", "id", "local", "numero", "prioridade", "responsavelId", "status", "titulo" FROM "OrdemServico";
DROP TABLE "OrdemServico";
ALTER TABLE "new_OrdemServico" RENAME TO "OrdemServico";
CREATE UNIQUE INDEX "OrdemServico_numero_key" ON "OrdemServico"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Auditoria_entidade_entidadeId_idx" ON "Auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "Auditoria_criadoEm_idx" ON "Auditoria"("criadoEm");
