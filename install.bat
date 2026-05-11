@echo off
setlocal

echo ==================================================
echo 🚀 Installing DeepInfra Code Quality MCP ^& CLI...
echo ==================================================

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Error: Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Error: npm is not installed. Please install npm first.
    exit /b 1
)

echo 📦 Installing dependencies...
call npm install

echo 🔨 Building project...
call npm run build

echo 🔗 Linking 'diq' CLI command globally...
echo (Note: This may require Administrator privileges)
call npm link

echo ==================================================
echo ✅ Installation Complete!
echo ==================================================
echo.
echo You can now use the CLI from anywhere:
echo   $ diq help
echo.

:: Automatically setup Antigravity MCP Config
echo 🤖 Configuring MCP settings...
node scripts/setup-mcp.js

pause
