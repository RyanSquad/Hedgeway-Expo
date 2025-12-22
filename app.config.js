export default {
  expo: {
    name: 'Hedgeway',
    slug: 'hedgeway-expo',
    version: '1.0.0',
    orientation: 'portrait',
    // icon: './assets/icon.png', // Optional - will use default if not provided
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.hedgeway.expo',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      package: 'com.hedgeway.expo',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    scheme: 'hedgeway',
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          // icon: './assets/notification-icon.png', // Optional - will use default if not provided
          color: '#ffffff',
          sounds: [],
        },
      ],
    ],
    extra: {
      // Add your environment variables here
      // These can be accessed via Constants.expoConfig?.extra
      apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
      eas: {
        projectId: "b4e2019c-e69e-4e1c-8533-06f2aabd8fb8"
      },
    },
  },
};

