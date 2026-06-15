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
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0b0e14',
  primaryColor: '#7c77ff',
  assetBundlePatterns: ['**/*'],
  // App icon / splash use Expo defaults until custom art is added under
  // mobile/assets (see README "Add app icon & splash"). This keeps builds green.
  androidStatusBar: {
    barStyle: 'light-content',
    backgroundColor: '#0b0e14'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: 1
  }
});
