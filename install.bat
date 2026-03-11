@echo off
REM 达梦数据库MCP服务器安装脚本 (Windows)

echo 达梦数据库MCP服务器安装向导

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

for /f "tokens=2 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
echo 检测到Node.js版本: %NODE_VERSION%

REM 检查npm是否可用
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到npm
    pause
    exit /b 1
)

echo 正在安装项目依赖...
npm install

echo.
echo 正在尝试安装达梦数据库驱动...

REM 尝试安装不同的达梦驱动包
echo 尝试安装 dmhs ^(达梦官方驱动^)...
npm install dmhs
if %errorlevel% equ 0 (
    echo ✓ dmhs 安装成功
    goto :check_env
) else (
    echo ⚠ dmhs 安装失败，尝试其他驱动包...
)

echo 尝试安装 @dameng/dm...
npm install @dameng/dm
if %errorlevel% equ 0 (
    echo ✓ @dameng/dm 安装成功
    goto :check_env
) else (
    echo ⚠ @dameng/dm 安装失败
)

echo 尝试安装 node-dm...
npm install node-dm
if %errorlevel% equ 0 (
    echo ✓ node-dm 安装成功
    goto :check_env
) else (
    echo ⚠ node-dm 安装失败
    echo.
    echo 警告: 未能自动安装达梦数据库驱动
    echo 请手动安装达梦数据库的Node.js驱动:
    echo   npm install dmhs
    echo   或 npm install @dameng/dm
    echo   或其他达梦提供的Node.js驱动包
)

:check_env
echo.
if not exist .env (
    echo 创建环境配置文件...
    copy .env.example .env
    echo ✓ 已复制 .env.example 到 .env，请根据实际情况修改数据库连接参数
) else (
    echo - .env 文件已存在，跳过创建
)

echo.
echo 安装完成！
echo.
echo 要启动MCP服务器，请运行:
echo   npm run dev
echo.
echo 首次运行前，请确保:
echo 1. 修改 .env 文件中的数据库连接参数
echo 2. 确保达梦数据库服务正在运行
echo 3. 确保网络可以访问达梦数据库服务器

pause