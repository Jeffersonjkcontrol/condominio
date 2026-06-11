-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "Conversa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MensagemIA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "arquivoUrl" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversaId" TEXT NOT NULL,
    CONSTRAINT "MensagemIA_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "Recibo_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recibo_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recibo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Recibo" ("arquivoUrl", "categoria", "criadoEm", "criadoPorId", "dadosExtraidos", "dataEmissao", "descricao", "fornecedorId", "id", "status", "textoExtraido", "valor") SELECT "arquivoUrl", "categoria", "criadoEm", "criadoPorId", "dadosExtraidos", "dataEmissao", "descricao", "fornecedorId", "id", "status", "textoExtraido", "valor" FROM "Recibo";
DROP TABLE "Recibo";
ALTER TABLE "new_Recibo" RENAME TO "Recibo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
