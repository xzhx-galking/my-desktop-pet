@echo off
chcp 65001 >nul
title 夜乃樱桌宠 — 打包安装程序
color 0E

:: ================================================================
::  build_installer.bat — 打包桌宠为安装程序
:: ================================================================
::
::  功能：将项目打包为 .exe 安装包，用于分发
::  用法：双击运行（需先执行 setup.bat）
::  输出：dist\my-desktop-pet-1.0.0-setup.exe
::
::  注意：不包含 GPT-SoVITS（需单独下载约 18GB）
:: ================================================================

cls
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║     📦 夜乃樱桌宠 正在打包...         ║
echo  ╚═══════════════════════════════════════╝
echo.

cd /d "%~dp0.."
echo  项目目录: %CD%
echo.
echo  构建需要 1~3 分钟，请勿关闭此窗口...
echo.
call npm run build:win
echo.
if %errorlevel% equ 0 (
    echo  ✅ 打包成功！
    echo  安装包: %CD%\dist\my-desktop-pet-1.0.0-setup.exe
) else (
    echo  ❌ 打包失败
    echo  常见原因：依赖未安装 / 磁盘空间不足
)
echo.
pause