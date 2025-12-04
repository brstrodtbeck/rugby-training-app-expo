@echo off
REM Helper to update app.json with Project ID
REM Usage: update-project-id.bat YOUR_PROJECT_ID

echo ========================================
echo Update Project ID in app.json
echo ========================================
echo.

if "%~1"=="" (
    echo Usage: update-project-id.bat YOUR_PROJECT_ID
    echo.
    echo Example: update-project-id.bat a1b2c3d4-e5f6-7890-abcd-ef1234567890
    echo.
    pause
    exit /b 1
)

set PROJECT_ID=%~1
set TEMP_FILE=app.json.tmp

echo Updating app.json with Project ID: %PROJECT_ID%
echo.

REM Use PowerShell to do the replacement (JSON is tricky in batch)
powershell -ExecutionPolicy Bypass -Command "$content = Get-Content 'app.json' -Raw; $content = $content -replace '\"YOUR_PROJECT_ID_HERE\"', '\"%PROJECT_ID%\"'; Set-Content 'app.json' -Value $content -NoNewline"

if %errorlevel% neq 0 (
    echo ERROR: Failed to update app.json
    echo Please update manually: Replace YOUR_PROJECT_ID_HERE with %PROJECT_ID%
    pause
    exit /b 1
)

echo.
echo ========================================
echo Successfully updated app.json!
echo.
echo Project ID has been set to: %PROJECT_ID%
echo ========================================
pause

