@echo off
REM Submit iOS Build to TestFlight

echo ========================================
echo Progressive Overlord - Submit iOS to TestFlight
echo ========================================
echo.

echo Submitting iOS build to App Store Connect...
echo This will upload your .ipa file to TestFlight.
echo Takes 5-10 minutes.
echo.

call eas submit --platform ios --profile production

if %errorlevel% neq 0 (
    echo ERROR: Submission failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Submission complete!
echo.
echo Next steps:
echo 1. Go to App Store Connect
echo 2. Set up TestFlight testers
echo 3. Wait for Apple to process (30 min - 24 hours)
echo 4. Install via TestFlight app
echo ========================================
pause

