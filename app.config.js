export default {
  expo: {
    name: 'Hedgeway',
    slug: 'hedgeway-expo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.hedgeway.expo',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
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
          icon: './assets/notification-icon.png',
          color: '#ffffff',
          sounds: [],
        },
      ],
    ],
    extra: {
      // Add your environment variables here
      // These can be accessed via Constants.expoConfig?.extra
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
    },
  },
};

