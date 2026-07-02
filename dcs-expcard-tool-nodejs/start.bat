@echo off
chcp 65001 >nul
title ExpCard Converter

echo ========================================
echo    ExpCard Converter 启动脚本
echo ========================================
echo.

REM 检查 Node.js 是否安装
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查配置文件是否存在
if not exist "config.js" (
    echo ℹ️  未找到 config.js，正在生成默认配置文件...
    node init-config.js
    echo.
)

REM 显示配置文件信息
echo 📄 当前配置文件: config.js
echo    如需修改，请编辑 config.js 后重新启动
echo.

REM 显示启动信息
echo 🚀 正在启动服务器...
echo    访问地址: http://localhost:3210
echo    按 Ctrl+C 停止服务器
echo ========================================
echo.

REM 启动服务器
node server.js

pause
