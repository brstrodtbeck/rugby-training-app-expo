# iOS TestFlight Setup - Step-by-Step

## What We're Doing

While your Android build is in queue, let's set up iOS testing via TestFlight. This will let you test your iOS app on your iPhone/iPad.

## Step 1: Submit iOS Build to TestFlight

You already have your iOS build ready:
- **iOS build URL:** https://expo.dev/artifacts/eas/3dmoEqEmUZhEiz3UrEZwfC.ipa

**Submit it to TestFlight using EAS:**

Run this command in Command Prompt:

```cmd
eas submit --platform ios --profile production
```

This will:
- Upload your `.ipa` file to App Store Connect
- Make it available in TestFlight
- Take about 5-10 minutes

## Step 2: Configure TestFlight in App Store Connect

After the upload completes:

1. **Go to App Store Connect:**
   - https://appstoreconnect.apple.com
   - Sign in with: `brstrodtbeck@gmail.com`

2. **Select Your App:**
   - Click "My Apps"
   - Select "Progressive Overlord"

3. **Go to TestFlight Tab:**
   - Click "TestFlight" in the top menu
   - Wait for your build to appear (may take 30 minutes - 24 hours)

4. **Set Up Internal Testing:**
   - Click "Internal Testing" in the left sidebar
   - Click "+" to create a test group (if none exists)
   - Name it: "Internal Testers"
   - Add your email: `brstrodtbeck@gmail.com`
   - Select your build
   - Save

## Step 3: Wait for Processing

- Apple needs to process your build
- Takes **30 minutes to 24 hours** (usually 1-2 hours)
- You'll get an email when ready
- Check TestFlight tab - build status will change

## Step 4: Install on Your iPhone/iPad

Once processing is complete:

1. **Install TestFlight app** from App Store (if not already installed)

2. **Open TestFlight app**

3. **Accept invitation** (you'll get an email) OR find your app in TestFlight

4. **Tap "Install"**

5. **Test your app!**

## Quick Commands

**Submit to TestFlight:**
```cmd
eas submit --platform ios --profile production
```

**Check submission status:**
```cmd
eas submit:list
```

## Timeline

- **Upload to TestFlight:** 5-10 minutes
- **Apple processing:** 30 minutes - 24 hours (usually 1-2 hours)
- **Total:** ~1-3 hours typically

---

## Let's Start!

**Right now, let's submit your iOS build to TestFlight!**

Run this command:
```cmd
eas submit --platform ios --profile production
```

This will upload your build and we can configure TestFlight while it processes!












