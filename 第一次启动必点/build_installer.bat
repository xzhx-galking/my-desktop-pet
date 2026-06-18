@echo off
title 夜乃樱桌宠 - 打包安装程序

:: ================================================================
::  build_installer.bat - 打包桌宠为安装程序
::  生成 exe 安装包，产物在 dist/ 目录下
::  打包内容：Electron运行时 + 立绘 + 音频
::  不包含 GPT-SoVITS（需单独下载）
:: ================================================================

echo.
echo =============================================
echo     夜乃樱桌宠 - 正在打包...
echo =============================================
echo.

cd /d "%~dp0..\夜乃樱桌宠_项目源码"
if %errorlevel% neq 0 (
    cd /d "%~dp0.."
)
echo 项目目录: %CD%
echo.
echo 构建需要 1~3 分钟，请勿关闭此窗口
echo.
call npm run build:win
echo.
if %errorlevel% equ 0 (
    echo [成功] 打包完成！
    echo 安装包位于: %CD%\dist\my-desktop-pet-1.0.0-setup.exe
) else (
    echo [失败] 打包出错
    echo 常见原因：依赖未安装 / 磁盘空间不足 / 权限不足
)
echo.
pause