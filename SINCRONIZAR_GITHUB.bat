@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sincronizar com GitHub - Grupo Solutions

call "%~dp0CONFIGURAR_GIT.bat"

echo ========================================================
echo   SINCRONIZANDO COM O REPOSITÓRIO GITHUB
echo ========================================================
echo.
git status --short
echo.
echo Adicionando alterações...
git add -A
git commit -m "Sincronização manual em %date% %time%"
echo Enviando para o GitHub (origin main)...
git push origin main
if errorlevel 1 (
    echo.
    echo [ERRO] Ocorreu uma falha no envio para o GitHub.
) else (
    echo.
    echo [SUCESSO] Repositório sincronizado com sucesso!
)
echo.
pause
