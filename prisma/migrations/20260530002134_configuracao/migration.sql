-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "nomeCondominio" TEXT NOT NULL DEFAULT 'Condomínio',
    "claudeApiKey" TEXT,
    "claudeModelo" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "geminiApiKey" TEXT,
    "geminiModelo" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "openaiApiKey" TEXT,
    "openaiModelo" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "atualizadoEm" DATETIME NOT NULL
);
