# Setting Up Android Studio Emulator - Step-by-Step Guide

## What is Android Studio?

**Android Studio** is Google's official development tool that **includes** the Android emulator. You download Android Studio, and it comes with everything you need to run an emulator on your computer.

## Step-by-Step Setup

### Step 1: Download Android Studio

1. Go to: https://developer.android.com/studio
2. Click **"Download Android Studio"**
3. Download the installer for Windows
4. File will be large (~1 GB) - be patient!

### Step 2: Install Android Studio

1. **Run the installer** you downloaded
2. **Follow the installation wizard:**
   - Click "Next" through the prompts
   - Choose installation location (default is fine)
   - It will install Android Studio + Android SDK + Emulator
   - This takes 5-10 minutes

### Step 3: First Launch Setup

1. **Open Android Studio** (after installation)
2. **First-time setup wizard:**
   - Choose "Standard" installation type
   - Let it download components (this takes 15-30 minutes)
   - Wait for "Finish" button

### Step 4: Create an Android Emulator

1. **Open Device Manager:**
   - In Android Studio, go to: **More Actions** → **Virtual Device Manager**
   - Or: **Tools** → **Device Manager** (if menu shows)

2. **Create Device:**
   - Click **"Create Device"** button
   - Choose a device (e.g., **Pixel 5** or **Pixel 6**)
   - Click **"Next"**

3. **Download System Image:**
   - Select a system image (e.g., **Android 13** or **Android 14**)
   - Click **"Download"** next to the system image you want
   - Wait for download (this takes 10-20 minutes, ~2-3 GB)
   - Click **"Next"** after download completes

4. **Finish Setup:**
   - Verify device configuration
   - Click **"Finish"**

### Step 5: Start the Emulator

1. In **Device Manager**, you'll see your virtual device
2. Click the **Play button** (▶️) next to your device
3. Wait for emulator to start (first time takes 2-5 minutes)
4. You'll see an Android phone screen on your computer!

### Step 6: Install Your App on Emulator

**Method 1: Build APK and Drag/Drop**

1. **Build your APK:**
   ```cmd
   eas build --platform android --profile preview
   ```

2. **Wait for build to complete** (10-20 minutes)

3. **Install on emulator:**
   - Make sure emulator is running
   - Simply **drag and drop** the `.apk` file onto the emulator window
   - Or double-click the `.apk` file (Windows may open it with emulator)

**Method 2: Use ADB Command**

1. Find where ADB is installed (usually in Android Studio SDK folder)
2. Use command:
   ```cmd
   adb install your-app.apk
   ```

## System Requirements

Make sure your computer can handle it:

- **RAM:** At least 8GB (16GB recommended)
- **Disk Space:** ~10GB free space
- **CPU:** Modern processor (any recent Intel/AMD)

## Time Estimates

- **Download Android Studio:** 5-15 minutes (depends on internet)
- **Install Android Studio:** 5-10 minutes
- **First-time setup:** 15-30 minutes (downloads components)
- **Download system image:** 10-20 minutes
- **First emulator startup:** 2-5 minutes
- **Total time:** ~1-2 hours (mostly waiting for downloads)

## Troubleshooting

**Emulator is slow?**
- Close other programs
- Allocate more RAM to emulator (in Device Manager → Edit device)
- Use a lighter system image

**Can't find Device Manager?**
- Look for "More Actions" menu in welcome screen
- Or: Tools → Device Manager (if project is open)

**Installation issues?**
- Make sure you have enough disk space
- Run installer as Administrator
- Check Windows compatibility

## Quick Start Summary

1. ✅ Download Android Studio
2. ✅ Install it
3. ✅ Open Device Manager
4. ✅ Create virtual device
5. ✅ Download system image
6. ✅ Start emulator
7. ✅ Install your APK on emulator
8. ✅ Test your app!

---

**Next:** Download Android Studio and follow these steps. Let me know if you run into any issues!












