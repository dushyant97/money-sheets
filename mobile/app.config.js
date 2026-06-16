// Expo app configuration for "Money Sheets" (offline-first, no backend).
//
// Identifiers can be overridden with env vars so forks/white-labels don't need
// to edit this file:
//   EXPO_PUBLIC_ANDROID_PACKAGE, EXPO_PUBLIC_IOS_BUNDLE_ID
//
// To produce an installable Android APK, see the "Build & release" section of
// the README (uses EAS Build with the `preview` profile).

const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.moneysheets.app';
const IOS_BUNDLE_ID = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.moneysheets.app';

module.exports = ({ config }) => ({
  ...config,
  name: 'Money Sheets',
  slug: 'money-sheets',
  scheme: 'moneysheets',
  version: '2.0.0',
  orientation: 'portrait',
  // Follow the system appearance; the in-app theme toggle overrides at runtime.
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0b0e14',
  primaryColor: '#7c77ff',
  assetBundlePatterns: ['**/*'],
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0b0e14'
  },
  androidStatusBar: {
    barStyle: 'light-content',
    backgroundColor: '#0b0e14'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    icon: './assets/icon.png',
    // Standard HTTPS only (Turso); no non-exempt encryption. Skips the export
    // compliance prompt on every TestFlight/App Store upload.
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: 2,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0b0e14'
    }
  }
});
