@echo off
REM Rebuild apps with updated icon

echo ========================================
echo Progressive Overlord - Rebuild with New Icon
echo ========================================
echo.

echo [1/3] Committing icon changes to git...
git add assets/icon.png assets/adaptive-icon.png
git commit -m "Update app icons"
echo.

echo [2/3] Building Android app with new icon...
call eas build --platform android --profile production
if %errorlevel% neq 0 (
    echo ERROR: Android build failed
    pause
    exit /b 1
)
echo.

echo [3/3] Building iOS app with new icon...
call eas build --platform ios --profile production
if %errorlevel% neq 0 (
    echo ERROR: iOS build failed
    pause
    exit /b 1
)
echo.

echo ========================================
echo Rebuilds complete with new icons!
echo.
echo Next: Resubmit to stores with new builds
echo ========================================
pause












