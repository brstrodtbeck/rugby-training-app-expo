@echo off
REM Build Both Android and iOS for Production

echo ========================================
echo Progressive Overlord - Build All Platforms
echo ========================================
echo.

echo Building both Android and iOS apps...
echo This will take 20-40 minutes.
echo.
echo NOTE: First iOS build will require Apple Developer credentials.
echo.

call eas build --platform all --profile production

if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Builds complete!
echo Check the EAS dashboard for your download links.
echo ========================================
pause

