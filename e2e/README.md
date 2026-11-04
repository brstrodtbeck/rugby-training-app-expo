# Maestro E2E Tests

End-to-end tests for the Rugby Training App using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. **Install Maestro CLI**
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```
   Or use the [installation guide](https://maestro.mobile.dev/docs/getting-started/installation).

2. **Build the app** (development build for testing)
   - Android: `npx expo run:android` or EAS build with `development` profile
   - iOS: `npx expo run:ios` or EAS build

3. **Start emulator/simulator** and install the app

## Fast Timers for E2E

To run session flows without waiting real time for timers:

1. Open the app and go to **Help** (hamburger menu) → **Test Validation**
2. Tap **E2E Fast Timers OFF** to enable (becomes **E2E Fast Timers ON**)
3. Timers run at 10x speed (e.g. 60s rest = 6s real time)

Or run the `enable-fast-timers` flow to automate this.

## Running Flows

```bash
# Enable fast timers (navigate to Test Validation and toggle)
maestro test e2e/flows/enable-fast-timers.yaml

# Complete a session (requires fast timers + 20-week program selected)
maestro test e2e/flows/session-complete.yaml
```

## Flow Descriptions

| Flow | Purpose |
|------|---------|
| `enable-fast-timers.yaml` | Navigates to Test Validation and enables 10x fast timers |
| `session-complete.yaml` | Opens a session, taps through exercises, finishes session |

## Customization

- **App ID**: Update `appId` in each flow if your bundle ID differs (Android: `com.progressiveoverlord.app`)
- **Session flow**: The session-complete flow uses optional taps; you may need to adjust selectors based on your calendar/session UI
- **Timeouts**: Increase `timeout` values for slower devices or longer sessions
