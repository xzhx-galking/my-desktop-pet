@echo off
title YoruYing Pet Setup
echo =============================================
echo   YoruYing Pet - Setup
echo =============================================
echo.
echo [1/4] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    start https://nodejs.org
    echo Please install Node.js LTS then re-run.
    pause
    exit /b
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%
echo.
echo [2/4] Entering project...
cd /d "%~dp0.."
echo [OK] %CD%
echo.
echo [3/4] Installing dependencies...
call npm install
if errorlevel 1 ( echo [FAIL] npm install failed & pause & exit /b )
echo [OK] Done.
echo.
echo [4/4] API key...
if not exist ".env" (
    echo DEEPSEEK_API_KEY=sk-replace_with_your_key > .env
    start notepad ".env"
) else (
    findstr /C:"sk-replace" ".env" >nul
    if errorlevel 1 ( echo [OK] API key ok ) else ( start notepad ".env" )
)
echo.
echo =============================================
echo   Setup Complete!
echo =============================================
echo.
echo Next: double-click ??.bat
pause