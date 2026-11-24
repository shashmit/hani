# hani

Your money, tasks, bookmarks and notes, in blocks. hani is a small personal app for Android and macOS with a woodland look and a squirrel called Hazel. Everything you add stays on your device: there is no account, no login and no server.

## What's inside

hani is a stack of full-screen blocks. Pull the dock to move between them, or hold it to jump to any block and reorder them.

- **Money**: set a monthly budget, log spending, and watch your acorn jar. Swipe left for every entry.
- **Tasks**: a day planner with a day strip, a progress dial, and tasks that hold sub-tasks.
- **Bookmarks**: collections that nest, tags, favourites, trash, and import from a browser bookmarks file.
- **Notes**: notes in folders, with tags.

The phone app follows your system light or dark setting.

## Download

Get the latest build from the [Releases page](https://github.com/shashmit/hani/releases/latest).

| Platform | File | Needs |
| --- | --- | --- |
| Android | `hani-<version>-android.apk` | Android 7.0 or newer, 64-bit ARM phone (nearly every phone) |
| Android, other devices | `hani-<version>-android-universal.apk` | Android 7.0 or newer; older 32-bit phones, emulators and Chromebooks |
| macOS | `hani-<version>-macos-arm64.dmg` | Apple silicon Mac, macOS 10.13 or newer |

### Installing on Android

Open the APK on your phone and allow your browser or file manager to install apps when Android asks.

### Installing on macOS

Open the DMG and drag hani into Applications. The app is not notarized by Apple, so the first launch is blocked. To allow it, run this once in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/hani.app
```

## Build from source

You need Node.js 20 or newer. The desktop app also needs [Rust](https://rustup.rs), and the Android app needs the Android SDK and a JDK.

```bash
npm install
npm run lint
npm run typecheck
```

**Android**

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```

**macOS**

```bash
npm run desktop        # run in development
npm run desktop:build  # build the .app and .dmg
```

## Tech

[Expo](https://expo.dev) (SDK 58) and React Native with Expo Router, Reanimated and Zustand. The desktop app wraps the web build in [Tauri](https://tauri.app). Data is stored locally on each device.
