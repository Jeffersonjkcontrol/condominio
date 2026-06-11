@echo off
title Sistema de Gestao do Condominio
cd /d "%~dp0"
echo ============================================
echo   Iniciando o Sistema de Gestao do Condominio
echo ============================================
echo.
echo Aguarde alguns segundos... o navegador vai abrir sozinho.
echo Para DESLIGAR o sistema, feche esta janela (ou pressione Ctrl+C).
echo.
start "" cmd /c "timeout /t 5 >nul & start http://localhost:3000"
npm run dev
