# Progressive Overlord - Tech Stack

## Quick Answer (Short Version)

**"I built it with React Native and Expo, using TypeScript. The app uses React Navigation for routing and React Native Paper for UI components. All data is stored locally with AsyncStorage. I built and deployed it using EAS Build."**

---

## Detailed Tech Stack

### Core Framework
- **React Native** (v0.81.5) - Cross-platform mobile framework
- **Expo SDK** (v54) - Development platform and build tooling
- **React** (v19.1.0) - UI library
- **TypeScript** (v5.9.2) - Type-safe JavaScript

### Navigation
- **React Navigation** (v7.x) - Navigation library
  - `@react-navigation/native` - Core navigation
  - `@react-navigation/native-stack` - Stack navigator

### UI Components & Styling
- **React Native Paper** (v5.14.5) - Material Design component library
- **Expo Linear Gradient** - Gradient backgrounds
- **React Native Vector Icons** - Icon library
- **React Native Modal** - Modal dialogs
- **React Native Safe Area Context** - Safe area handling

### Data Visualization
- **React Native Gifted Charts** (v1.4.66) - Charts and graphs
- **React Native Chart Kit** (v6.12.0) - Additional charting
- **React Native SVG** (v15.12.1) - SVG rendering

### Data Storage
- **AsyncStorage** (v2.2.0) - Local, persistent key-value storage
  - All workout data stored locally on device
  - No cloud sync, no backend required

### Additional Libraries
- **React Native Calendars** - Calendar component
- **React Native Progress** - Progress bars and indicators
- **React Native Gesture Handler** - Touch gestures
- **React Native Reanimated** - Animations
- **Day.js** - Date manipulation
- **Lodash** - Utility functions
- **React Native Toast Message** - Toast notifications
- **React Native Dropdown Picker** - Dropdown menus

### Build & Deployment
- **EAS Build** - Expo Application Services for building
- **EAS Submit** - Automated submission to app stores

### Architecture Features
- **Expo New Architecture** - Enabled (React Native's new architecture)
- **TypeScript** - Full type safety throughout
- **Component-based architecture** - Reusable React components
- **Custom progression logic** - Algorithm implementation for Rule of 3 and 1RM tracking

---

## What You Can Say (Different Lengths)

### Elevator Pitch (30 seconds)
*"I built it with React Native and Expo using TypeScript. It's a cross-platform app with local data storage, so no backend needed. I used React Navigation for routing and React Native Paper for the UI components. Built and deployed using EAS Build."*

### Medium Answer (1-2 minutes)
*"It's built with React Native and Expo SDK 54, written in TypeScript for type safety. The app uses React Navigation for navigation and React Native Paper for the UI components. All data is stored locally using AsyncStorage - no cloud backend, everything stays on the device. For charts and progress visualization, I used React Native Gifted Charts. The build and deployment pipeline uses EAS Build, which handles the compilation and submission to both iOS and Android app stores automatically."*

### Technical Deep Dive (if asked)
*"It's a React Native app built on Expo SDK 54. I chose TypeScript for type safety, especially important for the complex progression algorithms. The app architecture uses React Navigation's stack navigator, with all state management handled through React hooks and local storage via AsyncStorage. For the UI, I used React Native Paper as the base component library, which provides a consistent Material Design look. The app implements custom algorithms for weight progression (Rule of 3 and hybrid 1RM tracking) in TypeScript. Data visualization uses React Native Gifted Charts. Since everything is local, there's no backend - just React Native with Expo's managed workflow. Builds are handled through EAS Build, which compiles native code and manages certificates automatically. The app uses Expo's new architecture for better performance."*

---

## Key Technologies Summary

| Category | Technology |
|----------|-----------|
| **Framework** | React Native + Expo |
| **Language** | TypeScript |
| **Navigation** | React Navigation |
| **UI Library** | React Native Paper |
| **Storage** | AsyncStorage (local only) |
| **Charts** | React Native Gifted Charts |
| **Build Tool** | EAS Build |
| **Deployment** | EAS Submit |

---

## Unique Aspects to Mention

✅ **No Backend** - Everything is client-side with local storage  
✅ **Cross-Platform** - Single codebase for iOS and Android  
✅ **TypeScript** - Full type safety for complex logic  
✅ **Custom Algorithms** - Rule of 3 and 1RM progression logic  
✅ **EAS Build** - Automated builds and deployments  
✅ **Privacy-First** - All data local, no cloud sync  

---

## Code Statistics (if relevant)

- **Language:** TypeScript/React
- **Platform:** iOS & Android (single codebase)
- **Storage:** Local-only (AsyncStorage)
- **Architecture:** Component-based React Native
- **Build:** EAS Build (managed by Expo)

---

## When Asked "Why This Stack?"

**React Native + Expo:**
- Cross-platform development (write once, run on both iOS and Android)
- Rapid development with Expo's managed workflow
- Large ecosystem and community support
- EAS Build handles complex native build processes

**TypeScript:**
- Type safety for complex progression algorithms
- Better IDE support and fewer runtime errors
- Easier to maintain and refactor

**Local Storage Only:**
- Privacy-first approach (no cloud dependency)
- Simpler architecture (no backend required)
- Offline-first functionality
- Faster performance (no network calls)

**EAS Build:**
- Automated native code compilation
- Handles code signing and certificates
- Seamless deployment to app stores
- No need for Mac to build iOS apps

---

## Quick Reference Cards

### For Technical Interview:
"React Native with Expo SDK 54, TypeScript, React Navigation, React Native Paper, AsyncStorage for local storage. Custom algorithms for progression tracking. EAS Build for deployment."

### For Non-Technical People:
"I used React Native, which lets you build apps for both iPhone and Android from one codebase. TypeScript ensures the code is reliable. I used Expo's tools to build and publish to the app stores."

### For App Store Description/About Section:
"Built with React Native and Expo, written in TypeScript. Privacy-first architecture with all data stored locally on your device."

---

**You're all set! Pick the version that fits the context of who you're talking to.**




