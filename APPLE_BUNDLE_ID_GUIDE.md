# Apple Bundle ID Configuration - What You Actually Need Now

## ✅ Good News: You DON'T Need to Configure Everything Now!

When creating a Bundle ID in Apple Developer Portal, you see a long list of capabilities. **You can skip most of them for now** and only enable what you actually use.

## What You Need RIGHT NOW (Minimum)

### 1. Create the Bundle ID (Required)
- Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/bundleId)
- Click the "+" button
- Select "App IDs"
- Fill in:
  - **Description**: `Progressive Overlord`
  - **Bundle ID**: `com.progressiveoverlord.app` (explicit - type it in)
- Click "Continue" → "Register"

**That's it for the Bundle ID creation!** ✅

### 2. Capabilities - Only Enable What You Actually Use

Based on your `app.json`, your app uses these permissions:
- **HealthKit** (Health data)
- **Camera** (for photos)
- **Photo Library** (for saving photos)

#### Minimal Configuration:

1. **Create the Bundle ID** (step above) - **No capabilities selected**
2. **Register it** - Click "Register"

That's all you need for now! You can add capabilities later.

## When to Add Capabilities

### Option 1: Let EAS Build Handle It (Recommended)
- EAS Build can automatically enable capabilities when you build
- You only need to configure them if the build fails with capability errors
- **Start with NO capabilities enabled** and see if the build works

### Option 2: Enable Only What You Use (If Needed)
If EAS Build asks for specific capabilities, enable only:
- **HealthKit** (if you're using HealthKit)
- **Camera** (if you're using camera)
- **Photo Library** (if you're accessing photos)

**Skip all the others for now!**

## What Capabilities to Skip (For Now)

You can safely skip these unless you specifically need them:
- ❌ App Groups
- ❌ Associated Domains  
- ❌ Background Modes
- ❌ Data Protection
- ❌ In-App Purchase
- ❌ Inter-App Audio
- ❌ Keychain Sharing
- ❌ Personal VPN
- ❌ Push Notifications (if not using)
- ❌ Sign in with Apple (if not using)
- ❌ Wireless Accessory Configuration
- ❌ And many others...

**Only enable what you actually use!**

## Your Current App Permissions

Looking at your `app.json`, you have:
```json
"infoPlist": {
  "NSHealthShareUsageDescription": "...",
  "NSHealthUpdateUsageDescription": "...",
  "NSCameraUsageDescription": "...",
  "NSPhotoLibraryUsageDescription": "..."
}
```

This means you might need:
- **HealthKit** capability (if using HealthKit framework)
- But for just camera/photo access, you typically **don't need** to enable capabilities - just the usage descriptions in app.json are enough

## Recommended Approach: Minimal Setup

### Step 1: Create Bundle ID (Do This Now)
1. Go to Apple Developer Portal → Identifiers
2. Click "+" → "App IDs"
3. Description: `Progressive Overlord`
4. Bundle ID: `com.progressiveoverlord.app` (explicit)
5. **Don't select any capabilities**
6. Click "Continue" → "Register"

### Step 2: Try Building First
```cmd
eas build --platform ios --profile production
```

### Step 3: Add Capabilities Only If Build Fails
- If the build succeeds → You're done! ✅
- If the build fails asking for capabilities → Add only the ones requested

## Common Capabilities You Might Need Later

Only enable if you actually use these features:

| Capability | When You Need It |
|------------|------------------|
| **HealthKit** | If using HealthKit framework (not just permission descriptions) |
| **Push Notifications** | If sending push notifications |
| **Sign in with Apple** | If using Apple Sign In |
| **In-App Purchase** | If selling products in-app |
| **Associated Domains** | If using universal links or app links |
| **Background Modes** | If running code in background |

**Most apps don't need any of these!**

## What to Do Now

1. ✅ **Create Bundle ID** with minimal setup (no capabilities)
2. ✅ **Create App in App Store Connect** (can use the Bundle ID you just created)
3. ✅ **Try building** - EAS will handle most of it
4. ✅ **Add capabilities later** only if build fails

## The Bottom Line

**You only need to:**
1. Create the Bundle ID with the ID: `com.progressiveoverlord.app`
2. Leave capabilities empty/unchecked
3. Register it

**That's it!** Everything else can wait until you actually need it (if ever).

---

## Quick Steps to Create Bundle ID (Minimal)

1. Go to: https://developer.apple.com/account/resources/identifiers/list/bundleId
2. Click the blue **"+"** button (top left)
3. Select **"App IDs"** → Click **"Continue"**
4. Select **"App"** → Click **"Continue"**
5. Fill in:
   - **Description**: `Progressive Overlord`
   - **Bundle ID**: Select **"Explicit"** and type: `com.progressiveoverlord.app`
6. **Scroll past all the capabilities** (don't check anything!)
7. Click **"Continue"**
8. Review and click **"Register"**

Done! ✅

No need to configure capabilities unless the build tells you to.

