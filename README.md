# Hedgeway Expo

A React Native app built with Expo, featuring Tamagui UI, authentication, database integration, and push notifications.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI (installed globally or via npx)
- Expo Go app on your mobile device (for development)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `env.example` to `.env` (or create `.env` file)
   - Fill in your Supabase credentials, API URL, and Expo Project ID

3. Start the development server:
```bash
npm start
```

### Running the App

- **iOS Simulator**: Press `i` in the terminal or run `npm run ios`
- **Android Emulator**: Press `a` in the terminal or run `npm run android`
- **Web**: Press `w` in the terminal or run `npm run web`
- **Expo Go**: Scan the QR code with the Expo Go app on your device

## Project Structure

- `app/` - Main application directory (Expo Router file-based routing)
  - `_layout.tsx` - Root layout component with Tamagui provider
  - `index.tsx` - Home screen
- `lib/` - Utility libraries
  - `supabase.ts` - Supabase client configuration
  - `auth.ts` - Authentication functions (sign up, sign in, sign out, etc.)
  - `database.ts` - Database query helpers (CRUD operations)
  - `api.ts` - API request utilities
  - `notifications.ts` - Push notification helpers
- `assets/` - Images, fonts, and other static assets
- `app.json` / `app.config.js` - Expo configuration
- `tamagui.config.ts` - Tamagui UI configuration

## Features

### UI Library
- **Tamagui** - Modern, performant UI library with theming support

### Authentication
- Supabase Auth integration
- Secure token storage with Expo SecureStore
- Functions for sign up, sign in, sign out, password reset
- Auth state change listeners

### Database
- Supabase PostgreSQL integration
- Helper functions for queries, inserts, updates, deletes
- Real-time subscriptions support

### API Integration
- Generic API request utilities
- Automatic authentication token injection
- GET, POST, PUT, PATCH, DELETE helpers

### Notifications
- Expo Notifications module configured
- Push notification support
- Local notification scheduling
- Notification listeners

## Configuration

### Environment Variables

Create a `.env` file in the root directory with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=your_api_base_url
EXPO_PUBLIC_PROJECT_ID=your_expo_project_id
```

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from the project settings
3. Add them to your `.env` file

### Push Notifications

1. Get your Expo Project ID from [expo.dev](https://expo.dev)
2. Add it to your `.env` file as `EXPO_PUBLIC_PROJECT_ID`
3. Configure notification permissions in your app

## Development

This project uses:
- **Expo Router** for navigation (file-based routing)
- **TypeScript** for type safety
- **Expo SDK 52** for the latest features
- **Tamagui** for UI components
- **Supabase** for authentication and database
- **Expo Notifications** for push notifications

## Usage Examples

### Authentication
```typescript
import { signIn, signUp, signOut } from '@/lib/auth';

// Sign in
const { data, error } = await signIn('user@example.com', 'password');

// Sign up
const { data, error } = await signUp('user@example.com', 'password');
```

### Database
```typescript
import { query, insert, update } from '@/lib/database';

// Query records
const { data, error } = await query('users', {
  filters: { active: true },
  orderBy: { column: 'created_at', ascending: false },
});

// Insert record
const { data, error } = await insert('users', { name: 'John', email: 'john@example.com' });
```

### API Requests
```typescript
import { get, post } from '@/lib/api';

// GET request
const { data, error } = await get('/api/users');

// POST request
const { data, error } = await post('/api/users', { name: 'John' });
```

### Notifications
```typescript
import { requestPermissions, scheduleLocalNotification } from '@/lib/notifications';

// Request permissions
const { granted, token } = await requestPermissions();

// Schedule notification
await scheduleLocalNotification('Hello', 'This is a test notification');
```

## Building

To build for production:
- iOS: `eas build --platform ios`
- Android: `eas build --platform android`

Make sure to set up [EAS Build](https://docs.expo.dev/build/introduction/) for production builds.

