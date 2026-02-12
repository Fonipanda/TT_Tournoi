@echo off
title Tournoi Chelles TT - Serveurs
color 0A

echo ============================================
echo    TOURNOI CHELLES TT - Demarrage
echo ============================================
echo.

:: Definir le repertoire de travail
cd /d "%~dp0"

:: Verifier que les dossiers existent
if not exist "backend" (
    echo [ERREUR] Dossier backend introuvable!
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERREUR] Dossier frontend introuvable!
    pause
    exit /b 1
)

echo [INFO] Demarrage du serveur Backend Django...
echo.

:: Demarrer le backend Django dans une nouvelle fenetre
start "Backend Django - Port 8000" cmd /k "cd /d %~dp0backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) && python manage.py runserver"

:: Attendre 3 secondes pour que le backend demarre
timeout /t 3 /nobreak >nul

echo [INFO] Demarrage du serveur Frontend Next.js...
echo.

:: Demarrer le frontend Next.js dans une nouvelle fenetre
start "Frontend Next.js - Port 3000" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Attendre 5 secondes pour que le frontend demarre
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo    SERVEURS DEMARRES AVEC SUCCES
echo ============================================
echo.
echo   Backend Django : http://127.0.0.1:8000
echo   Frontend Next.js : http://localhost:3000
echo.
echo   Ouvrez votre navigateur sur:
echo   http://localhost:3000
echo.
echo ============================================
echo.
echo Appuyez sur une touche pour ouvrir l'application...
pause >nul

:: Ouvrir le navigateur par defaut
start "" "http://localhost:3000"

echo.
echo Pour arreter les serveurs, fermez les fenetres
echo "Backend Django" et "Frontend Next.js"
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
