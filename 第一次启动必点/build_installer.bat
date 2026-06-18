@echo off
title YoruYing Pet - Build
echo =============================================
echo   Building installer...
echo =============================================
cd /d "%~dp0.."
echo [OK] %CD%
call npm run build:win
if errorlevel 1 ( echo [FAIL] ) else ( echo [OK] Installer: %CD%\dist\setup.exe )
pause