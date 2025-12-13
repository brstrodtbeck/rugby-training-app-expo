# Find and Assign Your New Build

## Problem: Can't Find New Build in App Store Connect

After rebuilding with a new icon, you need to:
1. **Submit the new build** to App Store Connect
2. **Wait for Apple to process it** (5-10 minutes)
3. **Assign it to your app version**

---

## Step 1: Submit Your New Build

**Did you submit the new build after rebuilding?**

If not, you need to submit it:

```cmd
eas submit --platform ios --profile production
```

This will:
- Upload your new build to App Store Connect
- Make it available in TestFlight

---

## Step 2: Find Your Build in App Store Connect

### Option A: Check TestFlight Tab

1. Go to: https://appstoreconnect.apple.com/apps/6756135098/testflight/ios
2. Sign in if needed
3. Look under **"iOS Builds"** section
4. Your new build should appear here after processing

**Status indicators:**
- "Processing" = Still uploading/processing (wait 5-10 minutes)
- "Ready to Test" = Available for TestFlight
- "Ready to Submit" = Available for App Store submission

### Option B: Check EAS Dashboard

1. Go to: https://expo.dev/accounts/brstrodtbeck/projects/brstr/builds
2. Find your latest iOS build
3. Check if it's complete and submitted

---

## Step 3: Assign Build to Your Version

Once your build appears (after processing):

1. **Go to App Store Connect:**
   - https://appstoreconnect.apple.com/apps/6756135098

2. **Click on your app:** "Progressive Overlord"

3. **Go to "App Store" tab** (left sidebar, NOT TestFlight)

4. **Find your version:**
   - Look for version 1.0.0 (or whatever version you're using)
   - If you don't see a version, click **"+ Version or Platform"**

5. **Scroll down to "Build" section:**
   - Look for: **"Select a build before you submit your app"**
   - Or: **"+" button** next to Build

6. **Select your new build:**
   - Click the button/link
   - A dropdown or list will appear
   - Select your new build (should show version/build number)
   - Click **"Done"** or **"Save"**

---

## Step 4: Submit for Review

After assigning the build:
1. Make sure all required fields are complete
2. Click **"Submit for Review"**

---

## Troubleshooting

### Build Not Showing in TestFlight?

**Possible reasons:**
1. **Not submitted yet** - Run `eas submit --platform ios --profile production`
2. **Still processing** - Wait 5-10 minutes, refresh the page
3. **Looking in wrong place** - Check TestFlight tab first, then App Store tab

### Previous Build Marked as Expired?

**That's fine!** You can:
- Keep old builds expired
- Use the new build for submission
- Old builds won't interfere

### Build Processing Taking Too Long?

- Normal processing: 5-10 minutes
- Sometimes up to 24 hours (rare)
- Check your email for status updates
- Check TestFlight tab periodically

---

## Quick Checklist

- [ ] New build completed successfully?
- [ ] Submitted to App Store Connect? (`eas submit`)
- [ ] Build appears in TestFlight tab?
- [ ] Build status is "Ready to Submit" or "Ready to Test"?
- [ ] Assigned build to app version in App Store tab?
- [ ] Ready to submit for review?

---

**Next Step: Let's check if your build was submitted!**

Run this to see:
```cmd
eas submit --platform ios --profile production
```

Or check your builds here:
https://expo.dev/accounts/brstrodtbeck/projects/brstr/builds

**What do you see when you go to the TestFlight tab?**












