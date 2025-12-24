# Edgeway Expo

A React Native app built with Expo, featuring Tamagui UI, external API integration, and push notifications.

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
   - Fill in your external API URL and Expo Project ID

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
  - `api.ts` - API request utilities for external API integration
  - `notifications.ts` - Push notification helpers
- `assets/` - Images, fonts, and other static assets
- `app.json` / `app.config.js` - Expo configuration
- `tamagui.config.ts` - Tamagui UI configuration

## Features

### UI Library
- **Tamagui** - Modern, performant UI library with theming support

### API Integration
- Generic API request utilities for external API
- Secure token storage with Expo SecureStore
- Automatic authentication token injection
- GET, POST, PUT, PATCH, DELETE helpers
- Token management functions (get, set, clear)

### Notifications
- Expo Notifications module configured
- Push notification support
- Local notification scheduling
- Notification listeners

## Configuration

### Environment Variables

Create a `.env` file in the root directory with:

```env
EXPO_PUBLIC_API_URL=your_external_api_base_url
EXPO_PUBLIC_PROJECT_ID=your_expo_project_id
```

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
- **External API** for backend services
- **Expo Notifications** for push notifications

## Usage Examples

### API Requests
```typescript
import { get, post, setAuthToken, getAuthToken, clearAuthToken } from '@/lib/api';

// Set authentication token (after login)
await setAuthToken('your-auth-token-here');

// GET request
const { data, error } = await get('/api/users');

// POST request
const { data, error } = await post('/api/users', { name: 'John' });

// Get current token
const token = await getAuthToken();

// Clear token (on logout)
await clearAuthToken();
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

