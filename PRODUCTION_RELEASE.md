# Production Release Guide - Version 1.0.2

## 🎯 What's New in This Release

This release includes major UI/UX improvements:
- **Expanded Scrollable Calendar**: Navigate through multiple weeks and months with smooth scrolling
- **Month/Year Navigation**: Easy navigation with prev/next buttons and "Jump to Date" feature
- **Enhanced Home Screen**: 
  - Workout preview for selected calendar dates
  - Start date banner for new users
  - Session overview open by default
- **Searchable Help**: Find help topics quickly with search functionality
- **Improved User Flow**: Better organization and information hierarchy

---

## 📋 Pre-Release Checklist

### 1. Update Version Numbers

**Current versions:**
- App version: `1.0.1` → Update to `1.0.2`
- iOS buildNumber: `5` → Update to `6`
- Android versionCode: `1` → Update to `2`

**Update `app.json`:**
```json
{
  "version": "1.0.2",
  "ios": {
    "buildNumber": "6"
  },
  "android": {
    "versionCode": 2
  }
}
```

### 2. Commit All Changes

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Release v1.0.2: Expanded calendar, enhanced home screen, and searchable help

- Added scrollable multi-week calendar with month navigation
- Implemented 'Jump to Date' feature for quick navigation
- Enhanced home screen with workout preview cards
- Added start date banner for new users
- Made session overview open by default
- Implemented searchable help functionality
- Improved overall UI/UX and information hierarchy"

# Push to repository (if using remote)
git push origin main
```

### 3. Verify Build Configuration

Check that `eas.json` is properly configured:
- ✅ Production profile exists
- ✅ iOS credentials are set
- ✅ Android service account key path is correct

---

## 🚀 Build for Production

### Option A: Build Both Platforms (Recommended)

```bash
npm run build:all
```

Or directly:
```bash
eas build --platform all --profile production
```

### Option B: Build Platforms Separately

**Android:**
```bash
npm run build:android
# or
eas build --platform android --profile production
```

**iOS:**
```bash
npm run build:ios
# or
eas build --platform ios --profile production
```

### Build Process

1. **EAS will prompt you:**
   - Confirm build configuration
   - Select build profile (choose `production`)
   - Confirm platform(s)

2. **Build will start:**
   - Builds run on EAS servers (typically 10-20 minutes)
   - You'll receive a build URL to monitor progress
   - You'll get an email when builds complete

3. **Monitor builds:**
   ```bash
   # List recent builds
   eas build:list
   
   # View specific build details
   eas build:view [BUILD_ID]
   ```

---

## 📱 Submit to App Stores

### iOS App Store

**Option 1: Automatic Submission (Recommended)**
```bash
npm run submit:ios
# or
eas submit --platform ios --profile production
```

**Option 2: Manual Submission**
1. Download the `.ipa` file from EAS build page
2. Open [App Store Connect](https://appstoreconnect.apple.com)
3. Go to your app → TestFlight or App Store
4. Click "+" to create new version
5. Upload the `.ipa` file using Transporter app

**Release Notes for iOS:**
```
Version 1.0.2 - Enhanced Calendar & Home Screen

New Features:
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
```

### Google Play Store

**Option 1: Automatic Submission**
```bash
npm run submit:android
# or
eas submit --platform android --profile production
```

**Option 2: Manual Submission**
1. Download the `.aab` file from EAS build page
2. Open [Google Play Console](https://play.google.com/console)
3. Go to your app → Production → Create new release
4. Upload the `.aab` file
5. Add release notes
6. Review and roll out

**Release Notes for Android:**
```
Version 1.0.2 - Enhanced Calendar & Home Screen

New Features:
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
```

---

## ✅ Post-Submission Checklist

### iOS
- [ ] Build submitted to App Store Connect
- [ ] Version information added
- [ ] Release notes added
- [ ] Screenshots updated (if needed)
- [ ] App description reviewed
- [ ] Privacy policy URL verified
- [ ] Submitted for review

### Android
- [ ] Build uploaded to Play Console
- [ ] Release notes added
- [ ] Store listing reviewed
- [ ] Screenshots updated (if needed)
- [ ] Privacy policy URL verified
- [ ] Rolled out to production

---

## 🔍 Testing Before Release

**Recommended Testing:**
1. ✅ Test calendar scrolling and navigation
2. ✅ Test "Jump to Date" functionality
3. ✅ Test workout preview cards
4. ✅ Test help search functionality
5. ✅ Test start date banner (reset onboarding)
6. ✅ Test all existing features still work
7. ✅ Test on both iOS and Android devices

---

## 📊 Monitoring After Release

### Track These Metrics:
- App Store/Play Store reviews
- Crash reports (if using crash reporting)
- User feedback
- Feature adoption (calendar usage, help searches)

### Common Issues to Watch:
- Calendar scrolling performance
- Date navigation issues
- Help search functionality
- Preview card display

---

## 🆘 Troubleshooting

### Build Fails
```bash
# Check build logs
eas build:list
eas build:view [BUILD_ID]

# Common fixes:
# - Check version numbers are incremented
# - Verify all dependencies are correct
# - Check for syntax errors
```

### Submission Fails
- **iOS**: Verify Apple ID and team ID in `eas.json`
- **Android**: Verify service account key path and permissions

### Version Conflicts
- Ensure `version`, `buildNumber`, and `versionCode` are all incremented
- Check that previous builds aren't blocking

---

## 📝 Quick Command Reference

```bash
# Update version (edit app.json first)
# Then commit:
git add app.json
git commit -m "Bump version to 1.0.2"

# Build
npm run build:all

# Submit
npm run submit:ios
npm run submit:android

# Monitor
eas build:list
eas build:view [BUILD_ID]
```

---

## 🎉 Next Steps After Release

1. **Monitor reviews** - Respond to user feedback
2. **Track metrics** - See how new features are used
3. **Plan next release** - Based on user feedback
4. **Update documentation** - If needed based on user questions

---

## 📞 Support

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Submit Docs**: https://docs.expo.dev/submit/introduction/
- **Expo Discord**: https://chat.expo.dev/

---

**Ready to release? Start with Step 1: Update version numbers!**

