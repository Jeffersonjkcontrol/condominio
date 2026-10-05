-- CreateTable
CREATE TABLE "ConsumoDiario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicadorId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "consumoLitros" REAL NOT NULL,
    "consumoEstimadoLitros" REAL NOT NULL,
    "reabastecidoLitros" REAL NOT NULL,
    "porHora" TEXT NOT NULL,
    "horaPico" INTEGER,
    "nivelMinimo" REAL,
    "nivelMaximo" REAL,
    "amostras" INTEGER NOT NULL,
    "cobertura" REAL NOT NULL,
    "calculadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumoDiario_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "IndicadorExterno" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "reservaLitros" REAL
);
INSERT INTO "new_IndicadorExterno" ("ativo", "criadoEm", "deviceLabel", "id", "nome", "ordem", "unidade", "variableLabel") SELECT "ativo", "criadoEm", "deviceLabel", "id", "nome", "ordem", "unidade", "variableLabel" FROM "IndicadorExterno";
DROP TABLE "IndicadorExterno";
ALTER TABLE "new_IndicadorExterno" RENAME TO "IndicadorExterno";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ConsumoDiario_dia_idx" ON "ConsumoDiario"("dia");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumoDiario_indicadorId_dia_key" ON "ConsumoDiario"("indicadorId", "dia");
