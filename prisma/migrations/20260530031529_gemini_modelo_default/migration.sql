-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracao" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "nomeCondominio" TEXT NOT NULL DEFAULT 'Condomínio',
    "claudeApiKey" TEXT,
    "claudeModelo" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "geminiApiKey" TEXT,
    "geminiModelo" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "openaiApiKey" TEXT,
    "openaiModelo" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "atualizadoEm" DATETIME NOT NULL
);
INSERT INTO "new_Configuracao" ("atualizadoEm", "claudeApiKey", "claudeModelo", "geminiApiKey", "geminiModelo", "id", "nomeCondominio", "openaiApiKey", "openaiModelo") SELECT "atualizadoEm", "claudeApiKey", "claudeModelo", "geminiApiKey", "geminiModelo", "id", "nomeCondominio", "openaiApiKey", "openaiModelo" FROM "Configuracao";
DROP TABLE "Configuracao";
ALTER TABLE "new_Configuracao" RENAME TO "Configuracao";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
