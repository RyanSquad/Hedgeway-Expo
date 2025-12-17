# Setup Checklist

Follow these steps to get your Hedgeway Expo app up and running:

## 1. Install Dependencies

```bash
npm install
```

## 2. Environment Variables

Create a `.env` file in the root directory (copy from `env.example`):

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=your_api_base_url
EXPO_PUBLIC_PROJECT_ID=your_expo_project_id
```

### Getting Your Credentials:

- **Supabase**: 
  1. Go to [supabase.com](https://supabase.com) and create a project
  2. Navigate to Settings > API
  3. Copy the Project URL and anon/public key

- **Expo Project ID**:
  1. Go to [expo.dev](https://expo.dev) and create/select a project
  2. Copy the Project ID from the project settings

- **API URL**: Your backend API base URL (if applicable)

## 3. App Assets

Add the following assets to the `assets/` folder:

- `icon.png` (1024x1024) - App icon
- `splash.png` (1242x2436 recommended) - Splash screen
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `favicon.png` (48x48) - Web favicon
- `notification-icon.png` (96x96) - Notification icon

## 4. Start Development Server

```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web
- Scan QR code with Expo Go app on your device

## 5. Configure Supabase (Optional but Recommended)

If you're using Supabase for authentication and database:

1. Set up authentication providers in Supabase dashboard
2. Create your database tables
3. Set up Row Level Security (RLS) policies
4. Configure email templates for auth emails

## 6. Test Notifications

1. Request notification permissions in your app
2. Test local notifications
3. Set up push notification certificates (for production)

## Next Steps

- Customize Tamagui theme in `tamagui.config.ts`
- Add more screens in the `app/` directory
- Set up your API endpoints
- Configure authentication flows
- Set up database schemas

