@echo off
title TaskForge - Crear instalador
echo ==========================================
echo        TASKFORGE - INSTALADOR WINDOWS
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Necesitas Node.js para construir el instalador.
  echo Descarga Node.js desde https://nodejs.org/
  pause
  exit /b 1
)
echo Instalando dependencias...
call npm install
if errorlevel 1 (
  echo ERROR al instalar dependencias.
  pause
  exit /b 1
)
echo.
echo Construyendo TaskForge-Setup-1.0.0.exe...
call npm run dist
if errorlevel 1 (
  echo ERROR al construir el instalador.
  pause
  exit /b 1
)
echo.
echo LISTO. El instalador esta en la carpeta release.
pause
