# Quick Start: Test Android Build

## The Problem

Your Android build is an `.aab` file, which can't be installed directly on devices. You need an `.apk` file for testing.

## Solution: Build an APK

**Run this command in Command Prompt:**

```cmd
eas build --platform android --profile preview
```

This will:
- Build an `.apk` file (installable)
- Take 10-20 minutes
- Give you a download link

## After the APK is Built

1. **Download the `.apk` file** from the link provided
2. **Transfer to your Android device:**
   - Email it to yourself
   - Use Google Drive/Dropbox
   - Use USB cable
3. **On your Android device:**
   - Open Settings → Security
   - Enable "Install from Unknown Sources" (or "Install unknown apps")
   - Open the downloaded `.apk` file
   - Tap "Install"
4. **Test your app!**

---

## Alternative: Upload to Play Console Internal Testing

If you prefer:

1. Go to [Google Play Console](https://play.google.com/console)
2. Select "Progressive Overlord"
3. Go to **Testing** → **Internal testing**
4. Upload your `.aab` file
5. Add yourself as tester
6. Install via Play Store link (after 1-2 hours processing)

---

**Recommendation:** Build the APK (first option) - it's faster and easier for initial testing!












