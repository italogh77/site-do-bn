@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Grupo Solutions - Controle de Veículos

call "%~dp0CONFIGURAR_GIT.bat"

echo ========================================================
echo   GRUPO SOLUTIONS — CONTROLE DE VEÍCULOS & REPOSITÓRIO
echo ========================================================
echo.
echo Iniciando o servidor local e abrindo o site no navegador...
echo Todas as alterações feitas no site poderão ser enviadas
echo diretamente para o GitHub com um clique!
echo.

start "" "http://localhost:3000"
node server.js
pause
