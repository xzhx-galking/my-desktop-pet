@echo off
title 夜乃樱桌宠 - 安装工具

:: ================================================================
::  setup.bat - 夜乃樱桌宠 一键安装
:: ================================================================
::  1. 检查 Node.js 是否安装
::  2. 进入项目目录
::  3. npm install 下载依赖
::  4. 配置 API 密钥
:: ================================================================

echo.
echo =============================================
echo     夜乃樱桌宠 - 一键安装工具
echo =============================================
echo.

:: ---- 第1步：检查 Node.js ----
echo [1/4] 检查 Node.js 环境...
echo -----------------------------------------------
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [未安装] Node.js 没有找到
    echo 正在打开下载页面，请安装 LTS 版本...
    start https://nodejs.org
    echo.
    echo 安装完成后，重新双击本脚本继续。
    pause
    exit /b
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [通过] Node.js %NODE_VER%
echo.

:: ---- 第2步：进入项目目录 ----
echo [2/4] 进入项目目录...
echo -----------------------------------------------
cd /d "%~dp0..\夜乃樱桌宠_项目源码"
if %errorlevel% neq 0 (
    cd /d "%~dp0.."
)
if not exist "package.json" (
    cd /d "%~dp0"
    if exist "..\package.json" cd /d "%~dp0.."
)
echo 当前目录: %CD%
echo.

:: ---- 第3步：安装依赖 ----
echo [3/4] 安装项目依赖...
echo -----------------------------------------------
echo 首次安装约 2~5 分钟，请保持网络畅通
echo.
call npm install
if %errorlevel% neq 0 (
    echo [失败] 依赖安装失败，请检查网络连接
    pause
    exit /b
)
echo [完成] 依赖安装完成
echo.

:: ---- 第4步：配置 API 密钥 ----
echo [4/4] 配置 API 密钥...
echo -----------------------------------------------
if not exist ".env" (
    echo DEEPSEEK_API_KEY=sk-请替换为你的Key > .env
    echo [提示] 已创建 .env 配置文件
    echo 正在打开记事本，请填入你的 API Key 后保存
    start notepad ".env"
) else (
    findstr /C:"sk-请替换" ".env" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [提示] API Key 尚未填写，正在打开 .env
        start notepad ".env"
    ) else (
        echo [通过] API Key 已配置
    )
)
echo.

:: ---- 完成 ----
echo =============================================
echo     安装完成！
echo =============================================
echo.
echo 下一步：双击「启动.bat」运行桌宠
echo.
pause
