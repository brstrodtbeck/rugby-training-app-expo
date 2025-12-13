# 🚀 Quick Release - Version 1.0.2

## ✅ Version Numbers Updated
- App version: `1.0.1` → `1.0.2` ✓
- iOS buildNumber: `5` → `6` ✓
- Android versionCode: `1` → `2` ✓

---

## 📝 Step 1: Commit Changes

```bash
git add .
git commit -m "Release v1.0.2: Expanded calendar, enhanced home screen, and searchable help

- Added scrollable multi-week calendar with month navigation
- Implemented 'Jump to Date' feature for quick navigation
- Enhanced home screen with workout preview cards
- Added start date banner for new users
- Made session overview open by default
- Implemented searchable help functionality
- Improved overall UI/UX and information hierarchy"
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

### Google Play Store:
```bash
npm run submit:android
```

---

## 📋 Release Notes (Copy for Store Listings)

### iOS & Android Release Notes:
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

## ⚡ One-Line Commands

**Full release (commit + build + submit):**
```bash
git add . && git commit -m "Release v1.0.2" && npm run build:all
```

Then after builds complete:
```bash
npm run submit:ios && npm run submit:android
```

---

## 📖 Full Details

See `PRODUCTION_RELEASE.md` for complete instructions and troubleshooting.

---

**Ready? Start with Step 1!** 🎯
