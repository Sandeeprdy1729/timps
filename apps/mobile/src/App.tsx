import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from './screens/HomeScreen';
import { ChatScreen } from './screens/ChatScreen';
import { MemoryScreen } from './screens/MemoryScreen';
import { IntegrationsScreen } from './screens/IntegrationsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { VoiceAssistantScreen } from './screens/VoiceAssistantScreen';
import { WorkflowsScreen } from './screens/WorkflowsScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { TeamScreen } from './screens/TeamScreen';

export type RootStackParamList = {
  Home: undefined;
  Chat: { sessionId?: string };
  Memory: undefined;
  Integrations: undefined;
  Settings: undefined;
  Voice: undefined;
  Workflows: undefined;
  Analytics: undefined;
  Activity: undefined;
  Team: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#f8f9fa' },
          headerTintColor: '#0f172a',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'TIMPS' }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: 'Chat' }}
        />
        <Stack.Screen
          name="Memory"
          component={MemoryScreen}
          options={{ title: 'Memory' }}
        />
        <Stack.Screen
          name="Integrations"
          component={IntegrationsScreen}
          options={{ title: 'Integrations' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
        <Stack.Screen
          name="Voice"
          component={VoiceAssistantScreen}
          options={{ title: 'Voice Assistant' }}
        />
        <Stack.Screen
          name="Workflows"
          component={WorkflowsScreen}
          options={{ title: 'Workflows' }}
        />
        <Stack.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
        <Stack.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ title: 'Activity' }}
        />
        <Stack.Screen
          name="Team"
          component={TeamScreen}
          options={{ title: 'Team' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
