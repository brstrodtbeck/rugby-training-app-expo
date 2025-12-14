# 🚀 Quick Release - Version 1.0.3 (RepMaster)

## ✅ Version Numbers Updated
- App name: `Progressive Overlord` → `RepMaster` ✓
- App version: `1.0.2` → `1.0.3` ✓
- iOS buildNumber: `6` → `7` ✓
- Android versionCode: `2` → `3` ✓

---

## 📝 Step 1: Commit Changes

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
- Fixed TypeScript navigation type error
- Fixed OnboardingScreen type error
- Fixed memory leak in calendar auto-scroll
- Fixed JSX.Element TypeScript error

Improvements:
- Better home screen organization
- Improved user flow and information hierarchy"
```

---

## 🏗️ Step 2: Build for Production

### Build Both Platforms:
```bash
npm run build:all
```

### Or Build Separately:
```bash
# Android only
npm run build:android

# iOS only
npm run build:ios
```

**Build time:** ~10-20 minutes per platform

**Monitor builds:**
```bash
eas build:list
```

---

## 📤 Step 3: Submit to Stores

### iOS App Store:
```bash
npm run submit:ios
```

**IMPORTANT:** After submission, update app name to "RepMaster" in App Store Connect → App Information

### Google Play Store:
```bash
npm run submit:android
```

**IMPORTANT:** After submission, update app name to "RepMaster" in Play Console → Store listing

---

## 📋 Release Notes (Copy for Store Listings)

### iOS & Android Release Notes:
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

## ⚡ One-Line Commands

**Full release (commit + build + submit):**
```bash
git add . && git commit -m "Release v1.0.3: RepMaster rebrand" && npm run build:all
```

Then after builds complete:
```bash
npm run submit:ios && npm run submit:android
```

---

## 📖 Full Details

See `PUSH_TO_PRODUCTION.md` for complete instructions and troubleshooting.

---

**Ready? Start with Step 1!** 🎯
