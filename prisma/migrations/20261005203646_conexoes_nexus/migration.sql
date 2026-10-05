-- CreateTable
CREATE TABLE "ConexaoNexus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IndicadorExterno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "variableLabel" TEXT NOT NULL,
    "unidade" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL DEFAULT 'GENERICO',
    "capacidadeLitros" REAL,
    "reservaLitros" REAL,
    "conexaoId" TEXT,
    CONSTRAINT "IndicadorExterno_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "ConexaoNexus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IndicadorExterno" ("ativo", "capacidadeLitros", "criadoEm", "deviceLabel", "id", "nome", "ordem", "reservaLitros", "tipo", "unidade", "variableLabel") SELECT "ativo", "capacidadeLitros", "criadoEm", "deviceLabel", "id", "nome", "ordem", "reservaLitros", "tipo", "unidade", "variableLabel" FROM "IndicadorExterno";
DROP TABLE "IndicadorExterno";
ALTER TABLE "new_IndicadorExterno" RENAME TO "IndicadorExterno";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
