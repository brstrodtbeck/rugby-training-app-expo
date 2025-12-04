# Immediate Next Steps: Release Your App

You're ready to release! Follow these steps in order.

## ⚠️ First: Fix PowerShell Execution Policy

Your system blocks scripts. **Choose ONE method:**

### Method 1: Fix PowerShell (Recommended - One-Time)
1. Right-click PowerShell → "Run as Administrator"
2. Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Type `Y` to confirm

### Method 2: Use Command Prompt Instead
- Open Command Prompt (not PowerShell)
- Navigate to your project folder
- Run all commands from there

---

## Step 1: Install & Login to EAS CLI

```bash
npm install -g eas-cli
eas login
```

Enter your Expo account credentials.

---

## Step 2: Initialize EAS Project

```bash
eas project:init
```

**IMPORTANT:** This will show you a project ID like:
```
✓ Linked to project @yourname/progressive-overlord (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

**COPY THAT PROJECT ID** - you'll need it next!

---

## Step 3: Update app.json with Project ID

Open `app.json` and replace `YOUR_PROJECT_ID_HERE` (line 51) with your actual project ID from Step 2.

For example:
```json
"projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

## Step 4: Create Apps in Store Consoles

### Google Play Console

1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Fill in:
   - App name: `Progressive Overlord`
   - Default language: `English`
   - App or game: `App`
   - Free or paid: `Free`
4. Click **"Create"**

You can complete the rest of the store listing later before submission.

### App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - Platform: `iOS`
   - Name: `Progressive Overlord`
   - Primary Language: `English`
   - Bundle ID: Create new → `com.progressiveoverlord.app`
   - SKU: `progressive-overlord-001`
4. Click **"Create"**

**After creation, note:**
- Your **App Store Connect App ID** (number shown after creating)
- Your **Apple Team ID** (10 characters, found in Apple Developer account)

---

## Step 5: Update eas.json for iOS Submission

Open `eas.json` and update the iOS submission section (lines 37-40):

Replace:
- `your-apple-id@example.com` → Your Apple ID email
- `YOUR_APP_STORE_CONNECT_APP_ID` → Your App Store Connect App ID (from Step 4)
- `YOUR_APPLE_TEAM_ID` → Your Apple Team ID (10 characters)

Example:
```json
"ios": {
  "appleId": "your.email@example.com",
  "ascAppId": "1234567890",
  "appleTeamId": "ABCD1234EF"
}
```

---

## Step 6: Build Your Apps

### Build Android First

```bash
eas build --platform android --profile production
```

- Takes 10-20 minutes
- Creates `.aab` file for Play Store
- You'll get a download link when done

### Build iOS

```bash
eas build --platform ios --profile production
```

- First build will ask for Apple Developer credentials
- Takes 10-20 minutes  
- Creates `.ipa` file for App Store
- You'll get a download link when done

### Or Build Both at Once

```bash
eas build --platform all --profile production
```

---

## Step 7: Test Your Builds

1. Download builds from EAS dashboard
2. Install on physical devices
3. Test all features thoroughly

**Don't skip this!** Test before submitting.

---

## Step 8: Prepare Store Listings

### Required for Both Stores:

**Privacy Policy URL** (REQUIRED)
- Must be HTTPS
- Must explain what data you collect
- Host it somewhere (GitHub Pages, your website, etc.)

### Google Play Store:
- [ ] App description
- [ ] Short description (80 chars)
- [ ] Screenshots (at least 2)
- [ ] Feature graphic (1024x500px)
- [ ] Privacy Policy URL
- [ ] Content rating questionnaire

### iOS App Store:
- [ ] App description
- [ ] Keywords (100 chars)
- [ ] Screenshots (iPhone/iPad sizes)
- [ ] Support URL
- [ ] Privacy Policy URL
- [ ] Age rating questionnaire

---

## Step 9: Submit to Stores

### Google Play Store

**Manual Upload (Easiest):**
1. Go to Play Console → Your App → Production
2. Click "Create new release"
3. Upload your `.aab` file
4. Add release notes
5. Complete store listing
6. Submit for review

### iOS App Store

**Automated (After updating eas.json):**
```bash
eas submit --platform ios --profile production
```

**Or Manual:**
1. Download `.ipa` from EAS
2. Use Transporter (Mac) or Xcode to upload

---

## Step 10: Complete Store Listings & Submit

1. Fill in all required information
2. Upload screenshots
3. Add privacy policy URL
4. Complete rating questionnaires
5. Submit for review!

**Review Times:**
- Google Play: 1-3 days
- iOS App Store: 1-7 days

---

## Quick Reference Commands

```bash
# Login
eas login

# Initialize project
eas project:init

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Build both
eas build --platform all --profile production

# Submit iOS (after build)
eas submit --platform ios --profile production

# View builds
eas build:list
```

---

## Need Help?

- Check `RELEASE_GUIDE.md` for detailed instructions
- Check `RELEASE_CHECKLIST.md` to track progress
- Check `POWERSHELL_FIX.md` if you have PowerShell issues

## Current Priority

**Right now, do Steps 1-3:**
1. Fix PowerShell OR use Command Prompt
2. Install EAS CLI and login
3. Initialize project and get your project ID

Then come back and we'll update the files together!

