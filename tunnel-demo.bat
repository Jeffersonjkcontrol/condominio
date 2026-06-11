@echo off
title Tunel publico (Cloudflare) - Demo Condominio
cd /d "%~dp0"
echo ============================================================
echo   Tunel publico para a reuniao (Cloudflare Tunnel)
echo ============================================================
echo.
echo Pre-requisito: o sistema deve estar rodando
echo (abra o iniciar-condominio.bat antes e deixe aberto).
echo.
echo Aguarde aparecer um link  https://....trycloudflare.com  abaixo,
echo copie e compartilhe com quem vai testar.
echo DEIXE ESTA JANELA ABERTA durante a reuniao.
echo ============================================================
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:3000
echo.
echo (tunel encerrado)
pause
