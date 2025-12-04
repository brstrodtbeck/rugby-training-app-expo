@echo off
REM Initialize EAS Project - Run this after setup-eas.bat

echo ========================================
echo Progressive Overlord - Project Initialization
echo ========================================
echo.

echo This will link your project to Expo and generate a Project ID.
echo.
echo IMPORTANT: After this runs, you'll see a Project ID displayed.
echo Copy that Project ID - you'll need it to update app.json!
echo.
pause

echo [1/1] Initializing EAS project...
call eas project:init
if %errorlevel% neq 0 (
    echo ERROR: Failed to initialize project
    pause
    exit /b 1
)
echo.

echo ========================================
echo Project initialized!
echo.
echo NEXT STEP: Copy the Project ID shown above and update app.json
echo Replace 'YOUR_PROJECT_ID_HERE' with your actual Project ID
echo ========================================
pause

