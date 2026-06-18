@echo off
chcp 65001 >nul
title 夜乃樱桌宠 — 一键安装工具
color 0B

:: ================================================================
::  setup.bat — 夜乃樱桌宠 一键安装脚本
:: ================================================================
::
::  路径说明：
::  本脚本在「第一次启动必点」文件夹内，
::  项目源码在上一级目录（仓库根目录）
::
::  步骤：
::    1. 检查 Node.js 是否安装
::    2. cd 到项目目录
::    3. npm install 下载依赖
::    4. 配置 API 密钥
:: ================================================================

cls
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║       🎀 夜乃樱桌宠 一键安装工具      ║
echo  ╚═══════════════════════════════════════╝
echo.

:: ── Step 1: 检查 Node.js ──
echo  [1/4] 检查 Node.js 环境...
echo  ────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ⚠️  未检测到 Node.js
    echo  正在打开下载页面，请安装 LTS 版本...
    start https://nodejs.org
    echo.
    echo  安装完成后，重新双击本脚本继续。
    pause
    exit /b
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  ✅ Node.js 已安装（版本 %NODE_VER%）
echo.

:: ── Step 2: 进入项目目录 ──
echo  [2/4] 进入项目目录...
echo  ────────────────────────────────────────────
cd /d "%~dp0.."
if %errorlevel% neq 0 (
    echo  ❌ 进入项目目录失败！
    pause
    exit /b
)
echo  ✅ 当前目录: %CD%
echo.

:: ── Step 3: 安装依赖 ──
echo  [3/4] 安装项目依赖...
echo  ────────────────────────────────────────────
echo  正在从 npm 下载依赖包（首次约 2~5 分钟）...
echo  请保持网络畅通，不要关闭此窗口。
echo.
call npm install
if %errorlevel% neq 0 (
    echo  ❌ 依赖安装失败！
    echo  请检查网络连接，或尝试设置国内镜像源：
    echo     npm config set registry https://registry.npmmirror.com
    pause
    exit /b
)
echo.
echo  ✅ 依赖安装完成
echo.

:: ── Step 4: 配置 API 密钥 ──
echo  [4/4] 配置 API 密钥...
echo  ────────────────────────────────────────────
if not exist ".env" (
    echo DEEPSEEK_API_KEY=sk-请替换为你的Key > .env
    echo  ⚠️  检测到未配置 API Key
    echo  已自动创建 .env 配置文件
    echo  现在打开记事本，请填入你的 DeepSeek API Key
    echo.
    timeout /t 2 >nul
    start notepad ".env"
) else (
    findstr /C:"sk-请替换" ".env" >nul 2>&1
    if %errorlevel% equ 0 (
        echo  ⚠️  API Key 尚未填写
        echo  将在关闭后打开 .env 文件
        timeout /t 2 >nul
        start notepad ".env"
    ) else (
        echo  ✅ API Key 已配置
    )
)
echo.

:: ── 完成 ──
echo  ╔═══════════════════════════════════════╗
echo  ║     🎉 安装完成！                      ║
echo  ║                                       ║
echo  ║  下一步：双击「启动.bat」启动桌宠      ║
echo  ╚═══════════════════════════════════════╝
echo.
echo  按任意键关闭本窗口...
pause >nul