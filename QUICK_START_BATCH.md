# Quick Start Using Batch Files 🚀

I've created batch files that bypass PowerShell restrictions. Here's how to use them:

## ⚡ Super Quick Start (3 Steps)

### Step 1: Install & Login
**Double-click:** `setup-eas.bat`

This will:
- Install EAS CLI
- Log you into Expo

### Step 2: Get Project ID
**Double-click:** `initialize-project.bat`

**COPY THE PROJECT ID** that appears (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 3: Update app.json

**Option A: Automatic (Easiest)**
1. Double-click: `update-project-id.bat YOUR_PROJECT_ID`
   - Replace `YOUR_PROJECT_ID` with the actual ID from Step 2
   - Example: `update-project-id.bat a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Option B: Manual**
1. Open `app.json`
2. Find line 51: `"projectId": "YOUR_PROJECT_ID_HERE"`
3. Replace `YOUR_PROJECT_ID_HERE` with your Project ID
4. Save

---

## 📦 Build Your Apps

After updating app.json and creating apps in store consoles:

### Build Android
**Double-click:** `build-android.bat`

### Build iOS  
**Double-click:** `build-ios.bat`

### Build Both
**Double-click:** `build-all.bat`

---

## 📋 Batch Files Overview

| File | Purpose |
|------|---------|
| `setup-eas.bat` | Install EAS CLI and login |
| `initialize-project.bat` | Get your Project ID |
| `update-project-id.bat PROJECT_ID` | Auto-update app.json |
| `build-android.bat` | Build Android app |
| `build-ios.bat` | Build iOS app |
| `build-all.bat` | Build both platforms |

---

## 🎯 Next Steps After Setup

1. ✅ Install EAS CLI (`setup-eas.bat`)
2. ✅ Get Project ID (`initialize-project.bat`)
3. ✅ Update app.json
4. 📱 Create apps in Google Play Console & App Store Connect
5. ⚙️ Update `eas.json` with iOS credentials
6. 🔨 Build your apps
7. 🧪 Test on devices
8. 📝 Prepare store listings
9. 🚀 Submit to stores

---

## 💡 Pro Tips

- All batch files work in Command Prompt or by double-clicking
- They bypass PowerShell execution policy restrictions
- Builds take 10-20 minutes - be patient!
- Test builds on real devices before submitting

---

## 🆘 Troubleshooting

**Batch file won't run?**
- Right-click → "Run as Administrator"
- Or open Command Prompt and run from there

**Need more help?**
- See `START_HERE.md` for detailed steps
- See `IMMEDIATE_NEXT_STEPS.md` for full guide

