@echo off
REM Submit new iOS build to App Store Connect

echo ========================================
echo Submit New iOS Build to App Store Connect
echo ========================================
echo.
echo This will upload your new build (with updated icon) to App Store Connect.
echo.
pause

call eas submit --platform ios --profile production

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Submission failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Submission complete!
echo.
echo Next steps:
echo 1. Wait 5-10 minutes for Apple to process
echo 2. Go to TestFlight tab in App Store Connect
echo 3. Assign build to your app version
echo ========================================
pause












