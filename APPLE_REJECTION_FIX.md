# Apple App Review Rejection - Fix Guide

## Two Issues to Fix

### Issue 1: Screenshot Problem (Guideline 2.3.3)
**Problem:** 13-inch iPad screenshots show the app on iPhone
**Fix:** Upload proper iPad screenshots showing the app on iPad

### Issue 2: HealthKit Disclosure (Guideline 2.5.1)
**Problem:** App uses HealthKit but doesn't clearly indicate it in the UI
**Fix:** Add clear HealthKit disclosure/indication in the user interface

---

## Issue 1: Fix Screenshots

### The Problem
Apple requires that iPad screenshots actually show the app running on iPad, not iPhone screenshots.

### Solution Steps

1. **Take New iPad Screenshots:**
   - You need to run your app on an iPad (simulator or device)
   - Take screenshots of the actual iPad interface
   - Required size: 2048 x 2732 pixels (12.9-inch iPad Pro)

2. **How to Take iPad Screenshots:**

   **Option A: iPad Simulator (Recommended)**
   - Open Xcode
   - Run your app on iPad Simulator (12.9-inch iPad Pro)
   - Take screenshots: `Cmd + S` in simulator
   - Or use: `xcrun simctl io booted screenshot screenshot.png`

   **Option B: Physical iPad**
   - Run your app on a physical iPad
   - Take screenshots normally
   - Resize to required dimensions if needed

3. **What Screenshots to Take:**
   - Home screen showing the app
   - Main workout/session screen
   - Exercise tracking screen
   - Progress/analytics screen
   - At least 3-4 screenshots showing core features

4. **Upload in App Store Connect:**
   - Go to App Store Connect → Your App
   - Click "App Store" tab → "Previews and Screenshots"
   - Find "12.9-inch iPad Pro (3rd generation)" section
   - Click "View All Sizes in Media Manager" if needed
   - Upload your new iPad screenshots
   - Replace the iPhone screenshots that are currently there

### Screenshot Requirements
- **Size:** 2048 x 2732 pixels (12.9-inch iPad Pro)
- **Format:** PNG or JPEG
- **Content:** Must show app running on iPad (not iPhone)
- **Quantity:** At least 3 screenshots

---

## Issue 2: Fix HealthKit Disclosure

### The Problem
Your app has HealthKit permissions configured in `app.json` (`NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`), but Apple requires that apps using HealthKit clearly indicate this to users in the UI.

### ✅ Solution Implemented

I've added a HealthKit disclosure notice to your onboarding screen. It appears on the first step when users see the 1RM setup screen.

**What Was Added:**
- Clear HealthKit disclosure box in the onboarding screen
- Explains that the app may integrate with HealthKit
- Mentions privacy and user control
- Visible to all users on first launch

**The Disclosure Text:**
```
🏥 HealthKit Integration

This app may integrate with Apple HealthKit to sync your workout data with the Health app. All health data remains private and is stored securely on your device. You can control HealthKit access in Settings.
```

### Alternative: If Not Using HealthKit

If you're **not actually using HealthKit** in the app, you can remove the HealthKit permissions from `app.json` instead:

**Remove from app.json:**
- Delete `NSHealthShareUsageDescription`
- Delete `NSHealthUpdateUsageDescription`

**This is simpler if HealthKit isn't being used.** But if you plan to use it later, keeping the disclosure is fine.

---

## Action Plan

### Step 1: Fix Screenshots (Priority 1)
1. Take new iPad screenshots (iPad Simulator or device)
2. Upload to App Store Connect
3. Replace the iPhone screenshots in the iPad section

### Step 2: Fix HealthKit Disclosure (Priority 2)
1. Decide where to add disclosure (onboarding, settings, or visible indicator)
2. Add clear text explaining HealthKit usage
3. Make it visible to users
4. Test that it appears correctly

### Step 3: Resubmit
1. After fixing both issues
2. Resubmit the app for review
3. In notes, mention: "Fixed iPad screenshots and added HealthKit disclosure"

---

## What I Can Help With

✅ **Screenshots:** Guide you through taking iPad screenshots
✅ **HealthKit Disclosure:** Help add the disclosure to your app code
✅ **Resubmission:** Guide you through resubmitting

**Which would you like to tackle first? I'd recommend starting with the HealthKit disclosure since that requires code changes.**

