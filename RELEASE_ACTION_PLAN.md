# Release Action Plan - Current Status

## ✅ Completed
- [x] EAS CLI installed and logged in
- [x] Project initialized (ID: `e7473b32-6477-4df9-b016-3227b603b30b`)
- [x] app.json updated with Project ID
- [x] Bug fixed: Rep count now visible when set count adjusts
- [x] All assets verified

## 🎯 Next Steps (Do These Now)

### Step 1: Create Bundle ID in Apple Developer Portal (5 minutes)

**Go to:** https://developer.apple.com/account/resources/identifiers/list/bundleId

1. Click the **"+"** button (top left, blue)
2. Select **"App IDs"** → Click **"Continue"**
3. Select **"App"** → Click **"Continue"**
4. Fill in:
   - **Description**: `Progressive Overlord`
   - **Bundle ID**: Select **"Explicit"** → Type: `com.progressiveoverlord.app`
5. **Scroll past all capabilities** (don't check anything - leave them all unchecked!)
6. Click **"Continue"**
7. Review and click **"Register"**

**Done!** ✅ No need to configure capabilities now.

---

### Step 2: Create App in App Store Connect (10 minutes)

**Go to:** https://appstoreconnect.apple.com

1. Click **"My Apps"** → **"+"** → **"New App"**
2. Fill in:
   - **Platform**: iOS
   - **Name**: Progressive Overlord
   - **Primary Language**: English
   - **Bundle ID**: Select `com.progressiveoverlord.app` (the one you just created)
   - **SKU**: `progressive-overlord-001`
3. Click **"Create"**

**After creating, note these (you'll need them):**
- **App Store Connect App ID**: The number shown (like: `1234567890`)
- **Apple Team ID**: Found in your Apple Developer account (10 characters, like: `ABCD1234EF`)

**Where to find Apple Team ID:**
- Go to: https://developer.apple.com/account
- Look at the top right - it shows your Team ID
- Or go to Membership → Team ID

---

### Step 3: Create App in Google Play Console (10 minutes)

**Go to:** https://play.google.com/console

1. Click **"Create app"**
2. Fill in:
   - **App name**: Progressive Overlord
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Free
3. Click **"Create app"**

**Note:** You can complete the rest of the store listing later. For now, just create the app.

---

### Step 4: Update eas.json with iOS Credentials

After you have:
- Your Apple ID email
- Your App Store Connect App ID (from Step 2)
- Your Apple Team ID (from Step 2)

**Share them with me and I'll update `eas.json` for you!**

Or update manually:
- Open `eas.json`
- Lines 35-37: Replace the placeholder values

---

### Step 5: Build Your Apps

Once `eas.json` is updated, you can build:

**Build Android:**
```cmd
eas build --platform android --profile production
```

**Build iOS:**
```cmd
eas build --platform ios --profile production
```

**Or build both:**
```cmd
eas build --platform all --profile production
```

---

## Current Priority

**Right now, do Steps 1-3:**
1. Create Bundle ID (Apple Developer Portal)
2. Create iOS app (App Store Connect)
3. Create Android app (Google Play Console)

Then come back and we'll update `eas.json` and start building!

---

## Quick Links

- **Apple Developer Portal**: https://developer.apple.com/account/resources/identifiers/list/bundleId
- **App Store Connect**: https://appstoreconnect.apple.com
- **Google Play Console**: https://play.google.com/console
- **Expo Dashboard**: https://expo.dev

---

## Need Help?

- **Bundle ID setup**: See `APPLE_BUNDLE_ID_GUIDE.md`
- **Detailed steps**: See `NEXT_STEPS_SIMPLIFIED.md`
- **Full guide**: See `RELEASE_GUIDE.md`

