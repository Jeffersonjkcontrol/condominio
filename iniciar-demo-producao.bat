@echo off
title Demo (PRODUCAO) - Sistema de Gestao do Condominio
cd /d "%~dp0"
echo ============================================================
echo   Demo em modo PRODUCAO (mais rapido e estavel que o normal)
echo   Use ISTO para a reuniao. NAO abra o iniciar-condominio.bat
echo   junto (os dois usam a mesma porta 3000).
echo ============================================================
echo.
echo Compilando a versao otimizada (1a vez leva 1-2 min)...
call npm run build
if errorlevel 1 (
  echo.
  echo *** Falha ao compilar. Veja a mensagem acima. ***
  pause
  exit /b 1
)
echo.
echo Iniciando o sistema...  acesse  http://localhost:3000
echo Para o link publico da reuniao, abra tambem o  tunnel-demo.bat
echo Para DESLIGAR: feche esta janela.
echo ============================================================
call npm run start
pause
