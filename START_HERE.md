# 🚀 START HERE - Quick Setup Guide

Since PowerShell is blocking scripts, I've created **batch files** that use Command Prompt instead. These will work immediately!

## Step 1: Install EAS CLI & Login

**Double-click this file:** `setup-eas.bat`

Or open **Command Prompt** and run:
```cmd
cd "C:\Users\brstr\Clone for fitness app\rugby-training-app-expo"
setup-eas.bat
```

This will:
- Install EAS CLI globally
- Log you into your Expo account

---

## Step 2: Initialize Project (Get Project ID)

**Double-click this file:** `initialize-project.bat`

Or run in Command Prompt:
```cmd
initialize-project.bat
```

**IMPORTANT:** After this runs, you'll see a **Project ID** displayed (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Copy that Project ID** - you'll need it next!

---

## Step 3: Update app.json

1. Open `app.json`
2. Find line 51: `"projectId": "YOUR_PROJECT_ID_HERE"`
3. Replace `YOUR_PROJECT_ID_HERE` with your actual Project ID from Step 2
4. Save the file

---

## Step 4: Create Apps in Store Consoles

### Google Play Console
1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Fill in:
   - App name: `Progressive Overlord`
   - Default language: `English`
   - App or game: `App`
   - Free or paid: `Free`
4. Click **"Create"**

### App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - Platform: `iOS`
   - Name: `Progressive Overlord`
   - Primary Language: `English`
   - Bundle ID: Create new → `com.progressiveoverlord.app`
   - SKU: `progressive-overlord-001`
4. Click **"Create"**

**After creating iOS app, note:**
- Your **App Store Connect App ID** (number shown)
- Your **Apple Team ID** (10 characters, from Apple Developer account)

---

## Step 5: Update eas.json for iOS Submission

1. Open `eas.json`
2. Find the iOS section (lines 37-40)
3. Update:
   - `your-apple-id@example.com` → Your Apple ID email
   - `YOUR_APP_STORE_CONNECT_APP_ID` → Your App Store Connect App ID
   - `YOUR_APPLE_TEAM_ID` → Your Apple Team ID

---

## Step 6: Build Your Apps

### Option A: Build Android Only
**Double-click:** `build-android.bat`

### Option B: Build iOS Only
**Double-click:** `build-ios.bat`

### Option C: Build Both
**Double-click:** `build-all.bat`

Builds take 10-20 minutes each. You'll get download links when complete.

---

## Step 7: Test Your Builds

1. Download builds from EAS dashboard
2. Install on physical devices
3. Test thoroughly before submitting!

---

## Step 8: Prepare Store Listings

### Required for Both:
- **Privacy Policy URL** (REQUIRED - must be HTTPS)
- App description
- Screenshots
- Content/age rating questionnaires

### Google Play Store:
- Short description (80 chars)
- Feature graphic (1024x500px)

### iOS App Store:
- Keywords (100 chars)
- Support URL

---

## Step 9: Submit to Stores

### Google Play Store (Manual - Easiest)
1. Go to Play Console → Your App → Production
2. Click "Create new release"
3. Upload your `.aab` file
4. Complete store listing
5. Submit for review

### iOS App Store (Automated)
After updating `eas.json`:
```cmd
eas submit --platform ios --profile production
```

Or create `submit-ios.bat` with:
```cmd
@echo off
eas submit --platform ios --profile production
pause
```

---

## Quick Command Reference

All batch files run from Command Prompt in your project directory:

- `setup-eas.bat` - Install EAS CLI and login
- `initialize-project.bat` - Get your Project ID
- `build-android.bat` - Build Android app
- `build-ios.bat` - Build iOS app
- `build-all.bat` - Build both platforms

---

## Need Help?

- See `IMMEDIATE_NEXT_STEPS.md` for detailed steps
- See `RELEASE_GUIDE.md` for complete documentation
- See `RELEASE_CHECKLIST.md` to track progress

---

## Current Priority

**Do Steps 1-3 now:**
1. Run `setup-eas.bat`
2. Run `initialize-project.bat` (copy the Project ID!)
3. Update `app.json` with your Project ID

Then come back and continue with the store listings!

