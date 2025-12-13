# Replace App Icon - Step-by-Step

## Your Assets Folder is Correct!

You're looking at the right place: `assets/` folder contains:
- ✅ `icon.png` - This is your iOS app icon
- ✅ `adaptive-icon.png` - This is your Android app icon
- ✅ `favicon.png` - Web favicon (not needed for app stores)
- ✅ `splash-icon.png` - Splash screen (different from icon)

## What to Replace

### For iOS App Store:
**Replace:** `icon.png`
- Must be 1024 x 1024 pixels
- PNG format
- No transparency

### For Android Play Store:
**Replace:** `adaptive-icon.png`
- Must be 1024 x 1024 pixels
- PNG format

## How to Replace (Simple!)

1. **Create or get your new icon** (1024x1024px PNG)

2. **Replace the files:**
   - Take your new icon image
   - **Right-click** on `icon.png` in your assets folder
   - Click **"Replace"** or **"Rename"** to delete the old one
   - **Save your new icon as:** `icon.png` in the same folder
   
   - Do the same for `adaptive-icon.png`

3. **Or simpler:**
   - Copy your new icon image
   - Go to the `assets` folder
   - Delete `icon.png` (the old one)
   - Paste/rename your new icon to `icon.png`
   - Delete `adaptive-icon.png` (the old one)
   - Paste/rename your new icon to `adaptive-icon.png`

## File Locations

Your icons are in:
```
rugby-training-app-expo/
  assets/
    icon.png          ← Replace this (iOS)
    adaptive-icon.png ← Replace this (Android)
```

## After Replacing

1. **Rebuild your apps** (icons are part of the build)
2. **Resubmit to stores** with new builds

---

## Quick Questions

1. **Do you have a new icon image ready?**
   - If yes, just replace those two files
   - If no, I can help you create or find one

2. **Is your new icon 1024x1024px?**
   - If yes, you're ready
   - If no, we can resize it

**The files you're looking at are exactly the right ones to replace!**












