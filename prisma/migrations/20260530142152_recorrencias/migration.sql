-- CreateTable
CREATE TABLE "Recorrencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoMesGerado" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fornecedorId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "Recorrencia_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recorrencia_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recibo" (
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
    "obraId" TEXT,
    "recorrenciaId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "Recibo_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recibo_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recibo_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "Recorrencia" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recibo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Recibo" ("arquivoUrl", "categoria", "criadoEm", "criadoPorId", "dadosExtraidos", "dataEmissao", "descricao", "fornecedorId", "id", "obraId", "status", "textoExtraido", "valor") SELECT "arquivoUrl", "categoria", "criadoEm", "criadoPorId", "dadosExtraidos", "dataEmissao", "descricao", "fornecedorId", "id", "obraId", "status", "textoExtraido", "valor" FROM "Recibo";
DROP TABLE "Recibo";
ALTER TABLE "new_Recibo" RENAME TO "Recibo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
