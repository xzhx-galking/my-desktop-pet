@echo off
title YoruYing Pet
echo =============================================
echo   YoruYing Pet - Launching...
echo =============================================
cd /d "%~dp0.."
echo [OK] %CD%
npm run dev
pause