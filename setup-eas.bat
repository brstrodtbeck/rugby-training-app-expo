@echo off
REM Setup script for EAS CLI - Run this in Command Prompt
REM This bypasses PowerShell execution policy issues

echo ========================================
echo Progressive Overlord - EAS Setup
echo ========================================
echo.

echo [1/3] Installing EAS CLI globally...
call npm install -g eas-cli
if %errorlevel% neq 0 (
    echo ERROR: Failed to install EAS CLI
    pause
    exit /b 1
)
echo.

echo [2/3] Checking EAS CLI version...
call eas --version
echo.

echo [3/3] Logging in to Expo...
echo Please enter your Expo account credentials when prompted.
call eas login
if %errorlevel% neq 0 (
    echo ERROR: Failed to login
    pause
    exit /b 1
)
echo.

echo ========================================
echo Setup complete!
echo Next step: Run 'initialize-project.bat'
echo ========================================
pause

