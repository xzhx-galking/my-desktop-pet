@echo off
chcp 65001 >nul
title 夜乃樱桌宠 — 一键安装

:: ================================================================
::  setup.bat — 夜乃樱桌宠 一键安装脚本
:: ================================================================
::  
::  功能：自动检查 Node.js 环境 → 安装 npm 依赖 → 配置 API 密钥
::  
::  用法：双击运行（首次使用必需）
::  依赖：需要网络连接
::  系统要求：Windows 10/11，Node.js 18+
::  
::  步骤说明：
::    1. 检测 node/npm 是否安装，未安装则打开下载页
::    2. cd 到项目目录「夜乃樱桌宠_项目源码」
::    3. 执行 npm install 安装全部依赖（约 2~5 分钟）
::    4. 检查 .env 配置文件，如不存在则自动创建模板
::
::  注意：
::    - 安装完成后，双击 run_dev.bat 启动桌宠
::    - 打包安装程序请运行 build_installer.bat
::    - GPT-SoVITS 需在应用内「语音模块」页面配置
:: ================================================================

echo ==========================================
echo   🎀 夜乃樱桌宠 — 一键安装
echo ==========================================
echo.

echo [1/4] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    start https://nodejs.org
    echo 未检测到 Node.js，请安装 LTS 版本后重试
    pause >nul
    exit /b
)
echo Node.js  OK

echo [2/4] 进入项目目录...
cd /d "%~dp0夜乃樱桌宠_项目源码"
if %errorlevel% neq 0 (
    echo 进入项目目录失败，请检查文件夹名是否正确
    pause
    exit /b
)

echo [3/4] 安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo 安装失败，请检查网络连接
    pause
    exit /b
)

echo [4/4] 检查 API 密钥...
if not exist ".env" (
    echo DEEPSEEK_API_KEY=sk-请替换为你的Key > .env
    start notepad .env
)

echo ==========================================
echo   安装完成！
echo ==========================================
echo.
echo 启动: 双击 run_dev.bat
echo 打包: 双击 build_installer.bat
echo.
pause