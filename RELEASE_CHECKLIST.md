# Release Checklist: Progressive Overlord

Use this checklist to track your release progress.

## Prerequisites ✅
- [x] Expo Account
- [x] Apple Developer Account  
- [x] Google Play Developer Account

## Step 1: Fix PowerShell Execution Policy (One-Time Setup)

Your system has script execution disabled. Fix this once:

**Option A (Recommended):** Run PowerShell as Administrator, then:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Option B:** Or use Command Prompt (cmd.exe) instead of PowerShell for all EAS commands

**Option C:** Run commands with bypass:
```powershell
powershell -ExecutionPolicy Bypass -Command "eas --version"
```

## Step 2: Install & Verify EAS CLI

```bash
npm install -g eas-cli
eas --version
```

## Step 3: Login to Expo

```bash
eas login
```

## Step 4: Initialize EAS Project

```bash
eas project:init
```

This will:
- Create a new project in your Expo account (or link existing)
- Generate a project ID (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **IMPORTANT**: Copy the project ID shown and we'll update `app.json` with it

## Step 5: Update app.json

Replace `YOUR_PROJECT_ID_HERE` in `app.json` with your actual project ID from Step 4.

## Step 6: Verify Assets

Check that these files exist and are properly sized:
- ✅ `./assets/icon.png` (1024x1024px, no transparency)
- ✅ `./assets/splash-icon.png` (recommended: 1242x2436px)
- ✅ `./assets/adaptive-icon.png` (1024x1024px)
- ✅ `./assets/favicon.png`

## Step 7: Create Apps in Store Consoles

### Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Click "Create app"
3. Fill in:
   - App name: **Progressive Overlord**
   - Default language: **English**
   - App or game: **App**
   - Free or paid: **Free**
4. Complete required declarations (you can finish these later before submission)
5. **Note your package name**: `com.progressiveoverlord.app` (already configured)

### App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - Platform: **iOS**
   - Name: **Progressive Overlord**
   - Primary Language: **English**
   - Bundle ID: **com.progressiveoverlord.app** (create if doesn't exist)
   - SKU: **progressive-overlord-001**
4. **Note your App Store Connect App ID** (you'll see this after creation)
5. **Note your Apple Team ID** (found in your Apple Developer account)

## Step 8: Update eas.json for Submission

After creating your apps in the stores, update `eas.json`:

**For iOS:**
- Replace `your-apple-id@example.com` with your Apple ID email
- Replace `YOUR_APP_STORE_CONNECT_APP_ID` with your App Store Connect App ID
- Replace `YOUR_APPLE_TEAM_ID` with your Apple Team ID (10 characters)

**For Android (Optional - for automated submission):**
- You can set up a service account key later, or submit manually through Play Console

## Step 9: Build Your Apps

### Build Android

```bash
eas build --platform android --profile production
```

This creates an `.aab` file for Google Play Store.
- Build takes 10-20 minutes
- You'll get a download link when complete

### Build iOS

```bash
eas build --platform ios --profile production
```

This creates an `.ipa` file for App Store.
- First build will prompt for Apple Developer credentials
- Build takes 10-20 minutes
- You'll get a download link when complete

### Build Both at Once

```bash
eas build --platform all --profile production
```

## Step 10: Test Your Builds

**Before submitting:**
1. Download the build from EAS dashboard
2. Install on a physical device
3. Test all major features
4. Test on different screen sizes/OS versions

## Step 11: Prepare Store Listings

### Google Play Store Required:
- [ ] App description (up to 4000 characters)
- [ ] Short description (up to 80 characters)
- [ ] At least 2 screenshots (up to 8)
- [ ] Feature graphic (1024x500px)
- [ ] Privacy Policy URL (REQUIRED)
- [ ] Content rating questionnaire

### iOS App Store Required:
- [ ] App description (up to 4000 characters)
- [ ] Keywords (up to 100 characters)
- [ ] Screenshots (various sizes for iPhone/iPad)
- [ ] Support URL
- [ ] Privacy Policy URL (REQUIRED)
- [ ] Age rating questionnaire

## Step 12: Submit to Stores

### Google Play Store

**Option A: Manual Upload**
1. Go to Google Play Console → Your App → Production
2. Click "Create new release"
3. Upload the `.aab` file from your EAS build
4. Add release notes
5. Review and roll out

**Option B: Automated (after setting up service account)**
```bash
eas submit --platform android --profile production
```

### iOS App Store

**Option A: Automated (Recommended)**
```bash
eas submit --platform ios --profile production
```

**Option B: Manual Upload**
1. Download the `.ipa` from EAS
2. Use Transporter app (Mac) or Xcode to upload to App Store Connect

## Step 13: Complete Store Listings & Submit

1. Fill in all required store listing information
2. Upload screenshots and graphics
3. Add privacy policy URL
4. Complete content/age rating questionnaires
5. Submit for review

**Review Times:**
- Google Play: 1-3 days typically
- iOS App Store: 1-7 days typically

## Current Status

- [ ] EAS CLI installed
- [ ] Logged into Expo
- [ ] Project initialized
- [ ] app.json updated with project ID
- [ ] Assets verified
- [ ] Google Play app created
- [ ] App Store Connect app created
- [ ] eas.json updated with credentials
- [ ] Android build completed
- [ ] iOS build completed
- [ ] Builds tested
- [ ] Store listings prepared
- [ ] Submitted to Google Play
- [ ] Submitted to App Store
- [ ] Apps live in stores!

## Notes

- Build times: 10-20 minutes per platform
- Review times: 1-7 days depending on store
- Keep your project ID, Team IDs, and App IDs handy
- Privacy policy is REQUIRED for both stores

## Privacy Policy

You MUST have a privacy policy URL before submitting. It should:
- Be accessible via HTTPS
- Explain what data you collect
- Explain how you use it
- List any third-party services
- Explain user rights

Consider hosting options:
- GitHub Pages (free)
- Your own website
- Privacy policy generators online

