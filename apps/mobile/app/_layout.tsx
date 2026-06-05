import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0D1117' },
          headerTintColor: '#C9943A',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0D1117' },
        }}
      />
    </>
  );
}
