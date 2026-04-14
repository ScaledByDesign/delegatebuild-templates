# Usage

## Built with
- Expo SDK 52, React Native 0.76, Expo Router 4 (file-based routing)
- NativeWind 4 (Tailwind CSS for RN), Zustand, TanStack Query, Zod
- Lucide React Native icons, date-fns

## Restrictions (CRITICAL)
- **DO NOT install new packages.** Only use dependencies already in `package.json`. The sandbox has a pre-built lockfile; `bun add` will break it.
- **DO NOT** modify `app.json`, `babel.config.js`, `metro.config.js`, or `package.json`
- **NO HTML elements.** Use React Native components only: `View`, `Text`, `Pressable`, `ScrollView`, `FlatList`, `Image`, `TextInput`, `SafeAreaView`, etc.
- **NO web-only APIs.** No `document`, `window`, `localStorage`. Use `AsyncStorage` or Zustand for state.
- **DO NOT import internal/transitive dependencies directly.** The following packages are in `package.json` only because they are required by Expo Router or NativeWind internally. Importing them in your code will cause runtime errors on web:
  - `react-native-reanimated` (causes `__reanimatedLoggerConfig is not defined`)
  - `react-native-gesture-handler`
  - `react-native-screens`
  - `react-native-safe-area-context` (use `SafeAreaView` from `react-native` instead)
  - `react-native-worklets`
- **For animations:** use `Animated` from `react-native` or simple state-driven transitions. Do NOT use `react-native-reanimated` directly.

## Path Aliases (CRITICAL)
`@/` maps to `src/`. Always use `@/` for imports from `src/`:
- `import { cn } from '@/lib/utils'` → resolves to `src/lib/utils.ts`
- `import { useStore } from '@/store/myStore'` → resolves to `src/store/myStore.ts`
- **WRONG:** `@/src/lib/utils` (double-nests: `src/src/lib/utils`)

## Styling
- Use NativeWind `className` props (Tailwind classes) on RN components
- Custom colors: define in `tailwind.config.js` under `theme.extend.colors`
- Utility: `import { cn } from '@/lib/utils'` for conditional classes

## Icons
Import from `lucide-react-native`:
```tsx
import { Home, Settings, Plus } from 'lucide-react-native';
<Home size={24} color="#000" />
```
Or from `@expo/vector-icons`:
```tsx
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="home" size={24} color="#000" />
```

## App Structure
- `app/_layout.tsx` - Root layout (Stack navigator)
- `app/(tabs)/_layout.tsx` - Tab navigator layout
- `app/(tabs)/index.tsx` - Home tab (replace with your UI)
- `app/(tabs)/explore.tsx` - Explore tab (replace with your UI)
- `app/+not-found.tsx` - 404 screen
- `src/lib/utils.ts` - cn() helper
- `src/global.css` - Tailwind base styles

## Adding Screens
Add files in `app/` for automatic routing:
```
app/(tabs)/settings.tsx  -> /settings (add tab in _layout.tsx)
app/details/[id].tsx     -> /details/:id (dynamic route)
```

## Component Example
```tsx
import { View, Text, Pressable } from 'react-native';
import { Heart } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export function Card({ title, liked }: { title: string; liked: boolean }) {
  return (
    <View className="bg-card rounded-2xl p-5 border border-border">
      <Text className="text-lg font-semibold text-foreground">{title}</Text>
      <Heart size={20} color={liked ? '#ef4444' : '#94a3b8'} />
    </View>
  );
}
```

## State Management
Use Zustand stores in `src/store/`:
```tsx
import { create } from 'zustand';

interface AppState {
  count: number;
  increment: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));
```
