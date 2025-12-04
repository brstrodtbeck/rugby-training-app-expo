@echo off
REM Get Project ID - Interactive version
echo ========================================
echo Progressive Overlord - Get Project ID
echo ========================================
echo.
echo This will initialize your EAS project and show you the Project ID.
echo.
echo IMPORTANT: Look for a line that shows a Project ID like:
echo   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
echo.
echo Copy that Project ID - you'll need it to update app.json!
echo.
pause
echo.
echo Running: eas project:init
echo.

eas project:init

echo.
echo ========================================
echo.
echo Did you see a Project ID above?
echo.
echo If yes, copy it and we'll update app.json next.
echo.
pause

