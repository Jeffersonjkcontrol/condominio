-- CreateTable
CREATE TABLE "EtapaServico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluidaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servicoId" TEXT NOT NULL,
    CONSTRAINT "EtapaServico_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
