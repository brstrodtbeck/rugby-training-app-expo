# Testing Your Builds - Step-by-Step Guide

## Overview

You have two builds to test:
- **Android**: `.aab` file (can't install directly - need APK or upload to Play Console)
- **iOS**: `.ipa` file (can install via TestFlight or Xcode)

## 🤖 Testing Android Build

### Problem: `.aab` files can't be installed directly

You have two options:

### Option A: Build an APK for Testing (Recommended)

An APK can be installed directly on Android devices.

**Build a test APK:**

```cmd
eas build --platform android --profile preview
```

This will:
- Create an `.apk` file (installable)
- Take 10-20 minutes
- Give you a download link

**Then:**
1. Download the `.apk` file to your computer
2. Transfer to your Android device (via USB, email, or cloud storage)
3. On your Android device:
   - Enable "Install from Unknown Sources" in Settings
   - Open the `.apk` file
   - Tap "Install"
4. Test your app!

### Option B: Upload to Google Play Internal Testing (Easier for Testing)

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app: "Progressive Overlord"
3. Go to **Testing** → **Internal testing**
4. Click **Create new release**
5. Upload your `.aab` file
6. Add testers (your Google account email)
7. Wait 1-2 hours for processing
8. Download the Play Store link and install on your device

---

## 🍏 Testing iOS Build

### Option A: Use TestFlight (Recommended - Easiest)

TestFlight is Apple's official beta testing platform.

**Step 1: Upload to App Store Connect**

You can use EAS Submit:

```cmd
eas submit --platform ios --profile production
```

Or manually:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **TestFlight** tab
4. Click **+** to add a build
5. Upload your `.ipa` file (or use Transporter app on Mac)

**Step 2: Set Up TestFlight**

1. In App Store Connect, go to **TestFlight** → **Internal Testing**
2. Add your Apple ID email as a tester
3. Wait for Apple to process (30 minutes - 24 hours)

**Step 3: Install on Your iPhone/iPad**

1. Install **TestFlight** app from App Store (if not already installed)
2. Open TestFlight
3. Accept the invitation email or find your app
4. Tap **Install**
5. Test your app!

### Option B: Install via Xcode (Mac Only)

If you have a Mac:

1. Open **Xcode**
2. Go to **Window** → **Devices and Simulators**
3. Connect your iPhone/iPad via USB
4. Drag the `.ipa` file to your device
5. Trust the developer certificate on your device (Settings → General → Device Management)
6. Launch the app!

---

## Quick Testing Checklist

Test these features:

- [ ] App launches successfully
- [ ] Navigation works
- [ ] All screens load properly
- [ ] Exercise/workout features work
- [ ] Readiness score functionality
- [ ] Set/rep tracking
- [ ] Progress tracking
- [ ] Data saves correctly
- [ ] No crashes or errors
- [ ] Performance is smooth

---

## Recommended Testing Order

1. **Build Android APK** (Option A above) - takes 10-20 minutes
   - Easier to install and test
   - Can test immediately

2. **Set up iOS TestFlight** (Option A above)
   - Upload `.ipa` file
   - Wait for processing
   - Install via TestFlight app

---

## Quick Commands

**Build Android APK for testing:**
```cmd
eas build --platform android --profile preview
```

**Submit iOS to TestFlight:**
```cmd
eas submit --platform ios --profile production
```

**Check your builds:**
```cmd
eas build:list
```

---

## Need Help?

- **Android APK build stuck?** Let me know and I can help troubleshoot
- **TestFlight setup issues?** I can guide you through it
- **Installation problems?** Share the error message

---

**Next:** Once you've tested and everything works, we'll prepare for store submission!












