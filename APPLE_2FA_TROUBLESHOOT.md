# Apple 2FA - Troubleshooting Input Issue

## If You Can't Type in the Prompt

The prompt might be expecting arrow keys or a specific format. Try these:

### Option 1: Use Arrow Keys
- Press the **Down Arrow** key to select an option
- Press **Enter** to confirm

### Option 2: Type Just the First Letter
- Type: `d` (for device)
- Or type: `s` (for sms)
- Then press Enter

### Option 3: Type the Full Word
- Type: `device` (all lowercase)
- Or type: `sms` (all lowercase)
- Press Enter

### Option 4: If Nothing Works

You might need to:
1. **Cancel the build** (Ctrl+C)
2. **Set up an App Store Connect API key** instead (more advanced but doesn't require interactive prompts)

## Alternative: Use App Store Connect API Key

If the interactive prompt isn't working, you can use an API key instead:

1. Go to: https://appstoreconnect.apple.com/access/api
2. Create an API key
3. Download the `.p8` file
4. Note the Key ID and Issuer ID
5. Update `eas.json` with these credentials

But let's try the simpler options first!

---

**Try:** Press arrow keys, or type `d` or `s` and see if that works.












