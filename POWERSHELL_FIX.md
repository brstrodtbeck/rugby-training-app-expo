# Fix PowerShell Execution Policy (Windows)

Your PowerShell is blocking script execution. Here's how to fix it:

## Quick Fix (Recommended)

**Run PowerShell as Administrator**, then execute:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Type `Y` when prompted.

## Alternative: Use Command Prompt

Instead of PowerShell, you can use Command Prompt (cmd.exe) which doesn't have this restriction:

1. Open Command Prompt (search for "cmd" in Start menu)
2. Navigate to your project:
   ```cmd
   cd "C:\Users\brstr\Clone for fitness app\rugby-training-app-expo"
   ```
3. Run all EAS commands from there

## Alternative: Bypass for Single Commands

If you want to keep using PowerShell, you can bypass the policy for individual commands:

```powershell
powershell -ExecutionPolicy Bypass -Command "eas --version"
```

## Verify It Works

After fixing, test with:
```bash
eas --version
```

You should see a version number like `5.x.x` or higher.

