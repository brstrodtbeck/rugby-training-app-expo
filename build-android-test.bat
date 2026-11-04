@echo off
REM Build Android APK for Testing

echo ========================================
echo Progressive Overlord - Build Android APK for Testing
echo ========================================
echo.

echo Building Android APK (installable version)...
echo This will take 10-20 minutes.
echo.

call eas build --platform android --profile preview

if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo APK build complete!
echo Download the .apk file and install on your Android device.
echo ========================================
pause
















