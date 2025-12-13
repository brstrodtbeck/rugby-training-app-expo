# Finding Your New Build in App Store Connect

## Where to Look

After rebuilding, your new build needs to be:
1. **Processed by Apple** (5-10 minutes)
2. **Uploaded to App Store Connect** (if you submitted it)
3. **Assigned to your app version**

## Step-by-Step: Find Your New Build

### Step 1: Check if Build is Processing

**Go to:** https://appstoreconnect.apple.com/apps/6756135098/testflight/ios

1. Sign in to App Store Connect
2. Select your app: "Progressive Overlord"
3. Go to **"TestFlight"** tab
4. Check **"iOS Builds"** section

**Look for:**
- Your new build should appear here
- Status will show: "Processing", "Ready to Submit", or "Ready to Test"

### Step 2: Check Build Status

If the build isn't showing:

**Option A: Check EAS Dashboard**
- Go to: https://expo.dev/accounts/brstrodtbeck/projects/brstr/builds
- Find your latest builds
- Check if they're complete and uploaded

**Option B: Resubmit Build**
- Your new build might not have been uploaded to App Store Connect yet
- You need to submit it again

### Step 3: Submit the New Build

**If build isn't in App Store Connect yet:**

Run:
```cmd
eas submit --platform ios --profile production
```

This will upload your new build to App Store Connect.

---

## Assign Build to Version

Once your build appears in TestFlight:

1. Go to your app → **"App Store"** tab (not TestFlight)
2. Find your version (1.0.0)
3. Look for **"Build"** section
4. Click **"Select a build before you submit your app"**
5. Choose your new build from the list
6. Save

---

## Common Issues

### Build Not Showing?

**Possible reasons:**
1. **Not uploaded yet** - Need to run `eas submit`
2. **Still processing** - Wait 5-10 minutes
3. **Looking in wrong place** - Check TestFlight tab first

### Build Expired?

**Don't worry!** You can:
- Mark old builds as expired (you already did this)
- Select the new build for your version
- Submit with the new build

---

## Quick Check

**What's the status?**
1. Did you run `eas submit` after rebuilding?
2. Can you see the build in TestFlight tab?
3. What does the build status say?

Let me know what you see and I'll help you find/assign it!












