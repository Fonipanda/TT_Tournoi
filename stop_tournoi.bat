@echo off
title Tournoi Chelles TT - Arret des serveurs
color 0C

echo ============================================
echo    ARRET DES SERVEURS
echo ============================================
echo.

echo [INFO] Arret des processus Node.js (Frontend)...
taskkill /F /IM node.exe 2>nul
if %errorlevel%==0 (
    echo [OK] Processus Node.js arretes
) else (
    echo [INFO] Aucun processus Node.js en cours
)

echo.
echo [INFO] Arret des processus Python (Backend)...
taskkill /F /IM python.exe 2>nul
if %errorlevel%==0 (
    echo [OK] Processus Python arretes
) else (
    echo [INFO] Aucun processus Python en cours
)

echo.
echo ============================================
echo    SERVEURS ARRETES
echo ============================================
echo.
echo Appuyez sur une touche pour fermer...
pause >nul
