// Configuration switch for UI development mode
// Set to true to use dummy data and bypass authentication
// Set to false to use Supabase for real data and authentication
export const UI_DEV = process.env.EXPO_PUBLIC_UI_DEV === "true" || false;
