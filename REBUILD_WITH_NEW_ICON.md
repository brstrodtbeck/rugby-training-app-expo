# Rebuild Apps with New Icon

## Your Icon is Updated!

Now we need to rebuild both apps so the new icon is included in the builds.

## Step 1: Commit the Icon Changes

First, commit the updated icon files to git (EAS needs this):

```cmd
git add assets/icon.png assets/adaptive-icon.png
git commit -m "Update app icons"
```

## Step 2: Rebuild Your Apps

Rebuild both platforms with the new icons:

### Option A: Build Both at Once (Recommended)

```cmd
eas build --platform all --profile production
```

This will:
- Build Android with new icon
- Build iOS with new icon
- Takes 20-40 minutes total

### Option B: Build Separately

**Android:**
```cmd
eas build --platform android --profile production
```

**iOS:**
```cmd
eas build --platform ios --profile production
```

## Step 3: Wait for Builds to Complete

- Each build takes 10-20 minutes
- You'll get download links when done
- New builds will have your updated icons

## Step 4: Resubmit to Stores

After builds complete:

**iOS:**
- Your new build will automatically replace the old one in App Store Connect
- Or use: `eas submit --platform ios --profile production`

**Android:**
- Upload the new `.aab` file to Play Console
- It will replace the previous build

---

## Quick Commands

**Commit changes:**
```cmd
git add assets/icon.png assets/adaptive-icon.png
git commit -m "Update app icons"
```

**Rebuild both:**
```cmd
eas build --platform all --profile production
```

**Or use batch file:**
- Double-click `build-all.bat`

---

## Timeline

- Commit changes: 1 minute
- Build time: 20-40 minutes (both platforms)
- After that: Ready to submit!

---

**Let's start by committing the changes, then rebuild!**












