# Emulator Setup Complete - Next Steps

## ✅ What You've Done

- ✅ Android Studio installed
- ✅ Emulator created (Pixel 9)
- ✅ System image downloaded

## Next Steps

### Step 1: Start the Emulator

1. In Android Studio, go to **Device Manager** (or **Virtual Device Manager**)
2. You should see your **Pixel 9** device listed
3. Click the **Play button** (▶️) next to your Pixel 9 device
4. Wait for the emulator to start (first time takes 2-5 minutes)
5. You'll see an Android phone screen appear on your computer!

### Step 2: Build Your App APK

You need to build an APK file of your app that can be installed on the emulator.

**Option A: Use the Batch File (Easiest)**

Double-click: **`build-android-test.bat`**

**Option B: Use Command Prompt**

In Command Prompt, run:
```cmd
cd "C:\Users\brstr\Clone for fitness app\rugby-training-app-expo"
eas build --platform android --profile preview
```

This will:
- Build your app as an `.apk` file
- Take 10-20 minutes
- Give you a download link when complete

### Step 3: Install APK on Emulator

Once your APK is built and downloaded:

1. **Make sure emulator is running** (you should see the Android phone screen)

2. **Drag and drop method (easiest):**
   - Simply **drag the `.apk` file** from your computer
   - **Drop it onto the emulator window**
   - The app will install automatically!

3. **Or use command line:**
   - Find where ADB is installed (usually in Android Studio SDK folder)
   - Run: `adb install your-app.apk`

### Step 4: Test Your App

1. On the emulator, find your app icon
2. Tap to open it
3. Test all features:
   - Navigation
   - Workouts
   - Readiness score
   - Data saving
   - Everything!

## Quick Summary

1. ✅ **Start emulator** - Click play button in Device Manager
2. ⏳ **Build APK** - Run `build-android-test.bat` (10-20 min)
3. 📥 **Download APK** - Get the file from EAS
4. 📱 **Install on emulator** - Drag and drop the APK file
5. 🎉 **Test your app!**

---

## Right Now

**First, start the emulator:**
- Go to Device Manager
- Click the play button (▶️) next to Pixel 9
- Wait for it to boot up (you'll see the Android home screen)

**Then, build your APK while the emulator is starting up!**

Ready to start the emulator? Let me know when it's running and we'll build the APK!












