-- CreateTable
CREATE TABLE "SubEtapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluidaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etapaId" TEXT NOT NULL,
    CONSTRAINT "SubEtapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaObra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
