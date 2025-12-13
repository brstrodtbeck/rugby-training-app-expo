# Quick Start: Test iOS Build

## Easiest Method: TestFlight

TestFlight is Apple's official beta testing platform - it's free and easy!

## Step 1: Upload to TestFlight

**Option A: Use EAS Submit (Easiest)**

Run this command:

```cmd
eas submit --platform ios --profile production
```

Follow the prompts - it will upload your `.ipa` file to App Store Connect automatically.

**Option B: Upload Manually**

1. Download your `.ipa` file:
   - https://expo.dev/artifacts/eas/3dmoEqEmUZhEiz3UrEZwfC.ipa

2. Go to [App Store Connect](https://appstoreconnect.apple.com)
3. Select your app: "Progressive Overlord"
4. Go to **TestFlight** tab
5. Click **+** to add a build
6. Upload the `.ipa` file (or use Transporter app if you have a Mac)

## Step 2: Set Up TestFlight

1. In App Store Connect, go to **TestFlight** → **Internal Testing**
2. Click **+** to add testers
3. Add your Apple ID email: `brstrodtbeck@gmail.com`
4. Save

## Step 3: Wait for Processing

- Apple needs to process your build
- Takes 30 minutes to 24 hours (usually 1-2 hours)
- You'll get an email when ready

## Step 4: Install on Your iPhone/iPad

1. **Install TestFlight app** from App Store (if not already)
2. **Open TestFlight**
3. You should see your app listed (or accept the invitation email)
4. **Tap "Install"**
5. **Test your app!**

---

## Alternative: Install via Xcode (Mac Only)

If you have a Mac:

1. Open **Xcode**
2. Window → Devices and Simulators
3. Connect iPhone/iPad via USB
4. Drag the `.ipa` file to your device
5. Trust developer certificate on device
6. Launch the app

---

**Recommendation:** Use TestFlight - it's the easiest and most reliable method!












