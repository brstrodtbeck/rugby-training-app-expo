# Next Step: Get Your Project ID

Great! You've completed Step 1 (setup-eas.bat). Now you need to get your Project ID.

## ⚠️ Important: Run This Interactively

The Project ID needs to be displayed so you can copy it. Please run this interactively:

## Option 1: Use the Batch File (Recommended)

**Double-click:** `initialize-project.bat`

OR

**Double-click:** `get-project-id.bat`

This will:
1. Run `eas project:init`
2. Show you the Project ID on screen
3. Let you copy it

## Option 2: Run Manually in Command Prompt

1. Open **Command Prompt** (not PowerShell)
2. Navigate to your project:
   ```cmd
   cd "C:\Users\brstr\Clone for fitness app\rugby-training-app-expo"
   ```
3. Run:
   ```cmd
   eas project:init
   ```

## What to Look For

After running, you'll see output like:

```
✓ Linked to project @yourname/progressive-overlord (a1b2c3d4-e5f6-7890-abcd-ef1234567890)
```

**The part in parentheses is your Project ID:**
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- It looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## After You Get the Project ID

1. **Copy the Project ID** (the long string in parentheses)
2. Come back here and tell me the Project ID
3. I'll update `app.json` for you automatically!

## Alternative: If You Already Have a Project

If your project is already linked to Expo, you can find your Project ID:
- In your Expo dashboard: https://expo.dev
- Look for your project "progressive-overlord"
- The Project ID will be shown there

---

**Next:** Once you have the Project ID, let me know and I'll update `app.json` for you!

