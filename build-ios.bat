@echo off
REM Build iOS App for Production

echo ========================================
echo Progressive Overlord - iOS Build
echo ========================================
echo.

echo Building iOS app for App Store...
echo This will take 10-20 minutes.
echo.
echo NOTE: First build will require Apple Developer credentials.
echo.

call eas build --platform ios --profile production

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

