@echo off
setlocal EnableDelayedExpansion

echo ================================
echo OryzaDiscordBot - Local Test
echo ================================
echo.

REM Interactive environment variable input
echo Please set environment variables:
echo.

REM Discord Token
:input_discord_token
set /p DISCORD_TOKEN="DISCORD_TOKEN: "
if "!DISCORD_TOKEN!"=="" (
    echo Error: DISCORD_TOKEN is required.
    goto input_discord_token
)

REM Discord Client ID
:input_client_id
set /p DISCORD_CLIENT_ID="DISCORD_CLIENT_ID: "
if "!DISCORD_CLIENT_ID!"=="" (
    echo Error: DISCORD_CLIENT_ID is required.
    goto input_client_id
)

REM Gemini API Key (Optional)
set /p GEMINI_API_KEY="GEMINI_API_KEY (Optional, press Enter to skip): "
if "!GEMINI_API_KEY!"=="" (
    echo GEMINI_API_KEY: Not set (ask command will not work)
) else (
    echo GEMINI_API_KEY: Set
)

REM MongoDB URI (Optional)
set /p MONGO_URI="MONGO_URI (Optional, press Enter to skip): "
if "!MONGO_URI!"=="" (
    echo MONGO_URI: Not set
) else (
    echo MONGO_URI: Set
)

REM Error Report Channel ID (Optional)
set /p ERROR_REPORT_CHANNEL_ID="ERROR_REPORT_CHANNEL_ID (Optional, press Enter to skip): "
if "!ERROR_REPORT_CHANNEL_ID!"=="" (
    echo ERROR_REPORT_CHANNEL_ID: Not set
) else (
    echo ERROR_REPORT_CHANNEL_ID: Set
)

echo.
echo ================================
echo Configuration complete! Starting bot...
echo ================================
echo.

REM Check Node.js installation
echo [DEBUG] Checking Node.js installation...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo Please download and install from https://nodejs.org/
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo [OK] Node.js found.

REM Check package.json existence
echo [DEBUG] Checking package.json...
if not exist "package.json" (
    echo [ERROR] package.json not found.
    echo Please run this script in the correct directory.
    echo Current directory: %CD%
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo [OK] package.json found.

REM Check npm install
echo [DEBUG] Checking node_modules...
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    echo [DEBUG] Running: npm install
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed with exit code: %ERRORLEVEL%
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] node_modules found.
)

REM Display configuration summary
echo.
echo ================================
echo Configuration Summary:
echo ================================
echo DISCORD_TOKEN: [HIDDEN]
echo DISCORD_CLIENT_ID: !DISCORD_CLIENT_ID!
if not "!GEMINI_API_KEY!"=="" echo GEMINI_API_KEY: [SET]
if not "!MONGO_URI!"=="" echo MONGO_URI: [SET]
if not "!ERROR_REPORT_CHANNEL_ID!"=="" echo ERROR_REPORT_CHANNEL_ID: !ERROR_REPORT_CHANNEL_ID!
echo ================================
echo.

REM Start bot with error handling
echo [INFO] Starting bot...
echo [INFO] Press Ctrl+C to stop the bot.
echo [DEBUG] Running: node index.js
echo.

node index.js
set BOT_EXIT_CODE=%ERRORLEVEL%

echo.
echo ================================
if %BOT_EXIT_CODE% equ 0 (
    echo [INFO] Bot stopped normally.
) else (
    echo [ERROR] Bot crashed with exit code: %BOT_EXIT_CODE%
    echo.
    echo Common issues:
    echo - Invalid DISCORD_TOKEN
    echo - Invalid DISCORD_CLIENT_ID  
    echo - Network connection issues
    echo - Missing permissions
    echo.
    echo Check the error messages above for more details.
)
echo ================================
echo.
echo Press any key to exit...
pause >nul