@echo off
REM Build Android App Bundle for Production

echo ========================================
echo Progressive Overlord - Android Build
echo ========================================
echo.

echo Building Android App Bundle for Google Play Store...
echo This will take 10-20 minutes.
echo.

call eas build --platform android --profile production

if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build complete!
echo Check the EAS dashboard for your download link.
echo ========================================
pause

