# Release Guide: Progressive Overlord

This guide will help you release your app to the Google Play Store and Apple App Store.

## Prerequisites

1. **Expo Account**: Sign up at [expo.dev](https://expo.dev) if you haven't already
2. **EAS CLI**: Install the Expo Application Services CLI
   ```bash
   npm install -g eas-cli
   ```
3. **Apple Developer Account** (for iOS): $99/year at [developer.apple.com](https://developer.apple.com)
4. **Google Play Developer Account** (for Android): $25 one-time at [play.google.com/console](https://play.google.com/console)

## Step 1: Install EAS CLI and Login

```bash
npm install -g eas-cli
eas login
```

## Step 2: Configure Your Project

1. **Update app.json**: 
   - Replace `YOUR_PROJECT_ID_HERE` in `app.json` with your actual Expo project ID
   - Update app name, bundle identifiers, and version as needed

2. **Initialize EAS**:
   ```bash
   eas build:configure
   ```

3. **Link your project** (if not already linked):
   ```bash
   eas project:init
   ```

## Step 3: Prepare Assets

### Required Assets:

1. **App Icon**: 
   - iOS: 1024x1024px PNG (no transparency)
   - Android: 1024x1024px PNG (no transparency)
   - Place in `./assets/icon.png`

2. **Splash Screen**: 
   - 1242x2436px (iPhone) or 2048x2732px (iPad)
   - Place in `./assets/splash-icon.png`

3. **Android Adaptive Icon**:
   - 1024x1024px PNG
   - Place in `./assets/adaptive-icon.png`

### Store Listing Assets:

**iOS App Store:**
- Screenshots (various sizes for iPhone/iPad)
- App preview videos (optional)
- App description (up to 4000 characters)
- Keywords (up to 100 characters)
- Support URL
- Marketing URL (optional)

**Google Play Store:**
- Screenshots (at least 2, up to 8)
- Feature graphic (1024x500px)
- App description (up to 4000 characters)
- Short description (up to 80 characters)
- Privacy Policy URL (required)

## Step 4: Build for Production

### Android Build

```bash
# Build Android App Bundle (required for Play Store)
eas build --platform android --profile production
```

This will:
- Create an `.aab` file (Android App Bundle)
- Upload it to EAS servers
- Provide a download link when complete

### iOS Build

```bash
# Build iOS app
eas build --platform ios --profile production
```

This will:
- Create an `.ipa` file
- Handle code signing automatically
- Provide a download link when complete

**Note**: First iOS build will require:
- Apple Developer account credentials
- App Store Connect API key (recommended) or manual certificate management

## Step 5: Submit to Stores

### Google Play Store

1. **Create App Listing**:
   - Go to [Google Play Console](https://play.google.com/console)
   - Click "Create app"
   - Fill in app details:
     - App name: "Progressive Overlord"
     - Default language: English
     - App or game: App
     - Free or paid: Free
     - Declarations: Complete all required sections

2. **Upload App Bundle**:
   - Go to "Production" → "Create new release"
   - Upload the `.aab` file from EAS build
   - Add release notes
   - Review and roll out

3. **Complete Store Listing**:
   - App description
   - Screenshots
   - Feature graphic
   - Privacy Policy URL (required)
   - Content rating questionnaire

4. **Submit for Review**:
   - Complete all required sections
   - Submit for review (typically 1-3 days)

### Apple App Store

1. **Create App in App Store Connect**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Click "My Apps" → "+" → "New App"
   - Fill in:
     - Platform: iOS
     - Name: "Progressive Overlord"
     - Primary Language: English
     - Bundle ID: `com.progressiveoverlord.app`
     - SKU: `progressive-overlord-001`

2. **Upload Build**:
   ```bash
   eas submit --platform ios --profile production
   ```
   
   Or manually:
   - Download the `.ipa` from EAS
   - Use Transporter app or Xcode to upload

3. **Complete App Information**:
   - App description
   - Screenshots
   - App preview videos (optional)
   - Keywords
   - Support URL
   - Privacy Policy URL (required)
   - Age rating questionnaire

4. **Submit for Review**:
   - Complete all required sections
   - Add version information
   - Submit for review (typically 1-7 days)

## Step 6: Update Version Numbers

For future releases, update version numbers:

**app.json:**
```json
{
  "version": "1.0.1",  // User-facing version
  "ios": {
    "buildNumber": "2"  // iOS build number
  },
  "android": {
    "versionCode": 2  // Android version code
  }
}
```

## Important Notes

### Privacy Policy
- **Required for both stores**
- Must be accessible via HTTPS URL
- Should cover:
  - What data you collect
  - How you use it
  - Third-party services (if any)
  - User rights

### Permissions
- Only request permissions you actually use
- Provide clear explanations in `infoPlist` (iOS) and `permissions` (Android)

### Testing
Before submitting:
1. Test on physical devices
2. Test all major features
3. Test on different screen sizes
4. Test with different Android/iOS versions

### Build Profiles
- `development`: For development builds with Expo Go
- `preview`: For internal testing (APK for Android)
- `production`: For store releases

## Troubleshooting

### Common Issues:

1. **Build fails**: Check EAS build logs
   ```bash
   eas build:list
   eas build:view [BUILD_ID]
   ```

2. **Code signing errors (iOS)**: 
   - Ensure Apple Developer account is active
   - Check bundle identifier matches App Store Connect

3. **Version conflicts**:
   - Ensure version numbers are incremented
   - Check that build numbers are unique

4. **Asset issues**:
   - Verify all required assets are present
   - Check file sizes and formats

## Quick Commands Reference

```bash
# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Build both
eas build --platform all --profile production

# Submit to stores
eas submit --platform android --profile production
eas submit --platform ios --profile production

# View builds
eas build:list

# View build details
eas build:view [BUILD_ID]

# Update credentials
eas credentials
```

## Next Steps After Release

1. Monitor crash reports (Firebase Crashlytics or Sentry)
2. Monitor user reviews
3. Plan update releases
4. Consider analytics (Firebase Analytics, Mixpanel, etc.)

## Support

- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit Docs](https://docs.expo.dev/submit/introduction/)
- [Expo Discord](https://chat.expo.dev/)

