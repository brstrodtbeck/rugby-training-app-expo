# 🚀 Push to Production - Version 1.0.3 (RepMaster)

## Current Status
- ✅ App name updated: **RepMaster**
- ✅ Version numbers updated: `1.0.3` (iOS build 7, Android versionCode 3)
- ✅ All bugs fixed (TypeScript errors, memory leaks)
- ✅ Code reviewed and ready

---

## Step-by-Step Instructions

### Step 1: Commit All Changes

Open your terminal in the project directory and run:

```bash
git add .
git commit -m "Release v1.0.3: App rebranded to RepMaster

Features:
- App renamed from 'Progressive Overlord' to 'RepMaster'
- Added scrollable multi-week calendar with month navigation
- Implemented 'Jump to Date' feature for quick navigation
- Enhanced home screen with workout preview cards
- Added start date banner for new users
- Made session overview open by default
- Implemented searchable help functionality

Bug Fixes:
- Fixed TypeScript navigation type error (OneRMHistory → 1RMHistory)
- Fixed OnboardingScreen type error (sessionsPerWeek)
- Fixed memory leak in calendar auto-scroll useEffect
- Fixed JSX.Element TypeScript error in HelpScreen

Improvements:
- Better home screen organization
- Improved user flow and information hierarchy
- Enhanced calendar navigation with month/year controls"
```

**Verify commit:**
```bash
git log -1
```

---

### Step 2: Build for Production

#### Option A: Build Both Platforms (Recommended)

```bash
npm run build:all
```

This will build both iOS and Android simultaneously. Each build takes ~10-20 minutes.

#### Option B: Build Platforms Separately

**Build Android first:**
```bash
npm run build:android
```

**Then build iOS:**
```bash
npm run build:ios
```

#### Monitor Build Progress

While builds are running, you can check status:

```bash
# List recent builds
eas build:list

# View specific build details (replace BUILD_ID with actual ID)
eas build:view [BUILD_ID]
```

**What to expect:**
- EAS will prompt you to confirm build configuration
- Select `production` profile when asked
- Builds run on EAS servers (you'll see a URL to monitor)
- You'll receive an email when builds complete
- Builds typically take 10-20 minutes each

---

### Step 3: Wait for Builds to Complete

**DO NOT proceed to Step 4 until both builds show "Finished" status.**

Check build status:
```bash
eas build:list
```

Look for builds with status `finished` and platform `ios` and `android`.

---

### Step 4: Submit to App Stores

#### iOS App Store Submission

```bash
npm run submit:ios
```

**What happens:**
- EAS will automatically upload the `.ipa` file to App Store Connect
- The build will appear in App Store Connect under your app
- You'll need to complete the submission in App Store Connect (see below)

**After automatic submission, go to App Store Connect:**
1. Visit [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Navigate to your app → "App Store" tab
3. Click "+" next to "iOS App" to create new version
4. Select the new build (version 1.0.3, build 7)
5. **IMPORTANT: Update App Name to "RepMaster"** in App Information section
6. Add release notes (see below)
7. Complete any required sections
8. Click "Submit for Review"

#### Google Play Store Submission

```bash
npm run submit:android
```

**What happens:**
- EAS will automatically upload the `.aab` file to Google Play Console
- The build will appear in Play Console under your app
- You'll need to complete the release in Play Console (see below)

**After automatic submission, go to Google Play Console:**
1. Visit [play.google.com/console](https://play.google.com/console)
2. Navigate to your app → "Production" → "Create new release"
3. The uploaded `.aab` should be available
4. **IMPORTANT: Update App Name to "RepMaster"** in Store listing
5. Add release notes (see below)
6. Review and roll out

---

## 📋 Release Notes (Copy & Paste)

### For iOS App Store Connect:

```
Version 1.0.3 - RepMaster Rebrand & Enhanced Calendar

New Features:
• App rebranded to RepMaster
• Scrollable multi-week calendar - navigate through weeks and months
• Jump to Date - quickly navigate to any date
• Workout preview cards - see session details without opening
• Start date banner - easy setup for new users
• Searchable help - find answers quickly

Improvements:
• Session overview now open by default
• Better home screen organization
• Improved user flow and information hierarchy
• Enhanced calendar navigation with month/year controls

Bug Fixes:
• Fixed navigation type errors
• Fixed memory leaks
• Improved app stability
```

### For Google Play Console:

```
Version 1.0.3 - RepMaster Rebrand & Enhanced Calendar

New Features:
• App rebranded to RepMaster
• Scrollable multi-week calendar - navigate through weeks and months
• Jump to Date - quickly navigate to any date
• Workout preview cards - see session details without opening
• Start date banner - easy setup for new users
• Searchable help - find answers quickly

Improvements:
• Session overview now open by default
• Better home screen organization
• Improved user flow and information hierarchy
• Enhanced calendar navigation with month/year controls

Bug Fixes:
• Fixed navigation type errors
• Fixed memory leaks
• Improved app stability
```

---

## ⚡ Quick Command Reference

```bash
# 1. Commit
git add . && git commit -m "Release v1.0.3: RepMaster rebrand"

# 2. Build both platforms
npm run build:all

# 3. Check build status
eas build:list

# 4. After builds complete, submit
npm run submit:ios
npm run submit:android
```

---

## 🕐 Estimated Timeline

- **Commit:** 1 minute
- **Build both platforms:** 15-30 minutes (can run in parallel)
- **Submit to stores:** 2-5 minutes each
- **Store review:** 
  - iOS: 1-7 days
  - Android: 1-3 days

**Total active time:** ~10 minutes  
**Total wait time:** 15-30 minutes for builds + store review time

---

## ✅ Post-Submission Checklist

### iOS
- [ ] Build submitted to App Store Connect
- [ ] Version 1.0.3 selected in App Store Connect
- [ ] **App name updated to "RepMaster" in App Information**
- [ ] Release notes added
- [ ] Screenshots reviewed (if changed)
- [ ] App description reviewed
- [ ] Privacy policy URL verified
- [ ] Submitted for review

### Android
- [ ] Build uploaded to Play Console
- [ ] **App name updated to "RepMaster" in Store listing**
- [ ] Release notes added
- [ ] Store listing reviewed
- [ ] Screenshots reviewed (if changed)
- [ ] Privacy policy URL verified
- [ ] Rolled out to production

---

## 🆘 Troubleshooting

### Build Fails
```bash
# Check build logs
eas build:list
eas build:view [BUILD_ID]

# Common fixes:
# - Ensure you're logged in: eas login
# - Check version numbers are incremented
# - Verify all dependencies are correct
```

### Submission Fails
- **iOS**: Verify Apple ID and team ID in `eas.json`
- **Android**: Verify service account key path in `eas.json`

### Need to Rebuild
If you need to rebuild after a fix:
1. Make your changes
2. Commit again
3. Run build command again
4. EAS will create a new build

---

## 📞 Support Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Submit Docs**: https://docs.expo.dev/submit/introduction/
- **Expo Discord**: https://chat.expo.dev/

---

**Ready to start? Begin with Step 1: Commit Changes!** 🎯
