# Assign New Build to App Version

## Finding and Assigning Your New Build

### Step 1: Find Your New Build

**Go to TestFlight Tab:**
1. App Store Connect → Your App → **"TestFlight"** tab
2. Look under **"iOS Builds"** section
3. Your new build should be listed there

### Step 2: Assign Build to Version

**Go to App Store Tab:**
1. App Store Connect → Your App → **"App Store"** tab (left sidebar)
2. Click on your version (1.0.0) or **"+ Version or Platform"**
3. Scroll down to **"Build"** section
4. Click **"Select a build before you submit your app"** or **"+"**
5. Choose your new build from the dropdown list
6. Click **"Done"** or **"Save"**

### Step 3: Submit for Review

Once the build is assigned:
1. Make sure all required fields are filled
2. Click **"Submit for Review"**

---

## If Build Doesn't Appear

**Check:**
1. Did you submit the build to App Store Connect?
   - Run: `eas submit --platform ios --profile production`
   
2. Is it still processing?
   - Check TestFlight tab
   - Wait 5-10 minutes

3. Check EAS Dashboard:
   - https://expo.dev/accounts/brstrodtbeck/projects/brstr/builds
   - See if build is complete

---

## Need to Resubmit Build?

If your new build isn't in App Store Connect yet:

```cmd
eas submit --platform ios --profile production
```

This will upload your new build.

---

**Can you check the TestFlight tab and let me know what you see there?**












