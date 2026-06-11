-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'USUARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "recebeNotificacoes" BOOLEAN NOT NULL DEFAULT false,
    "podeUsarIA" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("ativo", "criadoEm", "email", "id", "nome", "papel", "recebeNotificacoes", "senhaHash") SELECT "ativo", "criadoEm", "email", "id", "nome", "papel", "recebeNotificacoes", "senhaHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
