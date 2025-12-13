# Update App Icon - Guide

## Current Icon Location

Your app icon is currently at:
- **iOS/General:** `./assets/icon.png`
- **Android:** `./assets/adaptive-icon.png`

## Icon Requirements

### iOS App Icon
- **Size:** 1024 x 1024 pixels
- **Format:** PNG
- **No transparency** (must have solid background)
- **File:** `./assets/icon.png`

### Android Adaptive Icon
- **Size:** 1024 x 1024 pixels  
- **Format:** PNG
- **Foreground:** `./assets/adaptive-icon.png`
- **Background color:** Currently `#E0E0E0` (can change in app.json)

## How to Update

### Step 1: Create Your New Icon

Create or get your new icon image:
- Must be 1024x1024px
- PNG format
- No transparency for iOS

### Step 2: Replace Icon Files

1. **Replace iOS icon:**
   - Save your new icon as: `assets/icon.png`
   - Replace the existing file

2. **Replace Android adaptive icon:**
   - Save your new icon as: `assets/adaptive-icon.png`
   - Replace the existing file

3. **Optional: Update background color** (Android adaptive icon):
   - In `app.json`, line 35, you can change:
     - `"backgroundColor": "#E0E0E0"`
     - To match your icon design

### Step 3: Rebuild Your Apps

**Important:** After updating icons, you need to rebuild for the new icon to appear:

```cmd
eas build --platform all --profile production
```

Or build separately:
- `eas build --platform ios --profile production`
- `eas build --platform android --profile production`

---

## Quick Steps

1. **Create/get your new icon** (1024x1024px PNG)
2. **Save as:** `assets/icon.png` (replace existing)
3. **Save as:** `assets/adaptive-icon.png` (replace existing)
4. **Rebuild apps** (icons are baked into the build)
5. **Resubmit to stores** with new builds

---

## After Updating Icon

1. ✅ Replace icon files in `assets/` folder
2. ⏳ Rebuild both apps (takes 20-40 minutes)
3. ⏳ Download new builds
4. ⏳ Submit new builds to stores (will replace old ones)

---

## Need Help?

- **Don't have an icon yet?** I can help guide you to create one
- **Need to resize an existing image?** I can help with that
- **Want to change background color?** Easy fix in app.json

**Do you already have your new icon ready, or do you need help creating/getting one?**












