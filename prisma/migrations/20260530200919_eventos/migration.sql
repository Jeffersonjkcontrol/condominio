-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Outro',
    "descricao" TEXT,
    "local" TEXT,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "reservante" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsavelId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "Evento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Evento_dataInicio_idx" ON "Evento"("dataInicio");

-- CreateIndex
CREATE INDEX "Evento_local_idx" ON "Evento"("local");
