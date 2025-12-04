# Quick Start: Release Your App

## Immediate Next Steps

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login to Expo
```bash
eas login
```

### 3. Initialize EAS Project
```bash
eas project:init
```
This will create a project ID - copy it and update `app.json`:
- Replace `YOUR_PROJECT_ID_HERE` in `app.json` with the actual project ID

### 4. Configure Build
```bash
eas build:configure
```

### 5. Update App Configuration

**Before building, update these in `app.json`:**

- ✅ App name: "Progressive Overlord" (already set)
- ✅ Bundle IDs: `com.progressiveoverlord.app` (already set)
- ⚠️ **Update project ID**: Replace `YOUR_PROJECT_ID_HERE` with your actual Expo project ID
- ⚠️ **Update splash background color**: Currently `#E0E0E0` - change to match your theme if needed

### 6. Prepare Assets

Make sure you have:
- ✅ App icon (1024x1024px) at `./assets/icon.png`
- ✅ Splash screen at `./assets/splash-icon.png`
- ✅ Android adaptive icon at `./assets/adaptive-icon.png`

### 7. Build Your App

**For Android:**
```bash
npm run build:android
# or
eas build --platform android --profile production
```

**For iOS:**
```bash
npm run build:ios
# or
eas build --platform ios --profile production
```

**For Both:**
```bash
npm run build:all
# or
eas build --platform all --profile production
```

### 8. Test Your Build

Download the build from the EAS dashboard and test on a physical device before submitting to stores.

### 9. Submit to Stores

**Android:**
```bash
npm run submit:android
# or
eas submit --platform android --profile production
```

**iOS:**
```bash
npm run submit:ios
# or
eas submit --platform ios --profile production
```

## Important Reminders

1. **Privacy Policy**: You MUST have a privacy policy URL before submitting to stores
2. **App Store Accounts**: 
   - iOS: Need Apple Developer account ($99/year)
   - Android: Need Google Play Developer account ($25 one-time)
3. **Version Numbers**: Increment these for each release:
   - `version` in `app.json` (user-facing)
   - `buildNumber` for iOS
   - `versionCode` for Android

## Need Help?

See `RELEASE_GUIDE.md` for detailed instructions.

