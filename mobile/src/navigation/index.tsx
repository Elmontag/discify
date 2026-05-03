import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Library, Settings as SettingsIcon } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import CollectionScreen from '../screens/CollectionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanScreen from '../screens/ScanScreen';
import AuthScreen from '../screens/AuthScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Scan: undefined;
};

export type TabParamList = {
  Collection: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Collection') {
            return <Library size={size} color={color} />;
          }
          if (route.name === 'Settings') {
            return <SettingsIcon size={size} color={color} />;
          }
          return null;
        },
        tabBarStyle: { backgroundColor: '#07111f', borderTopColor: '#1a2a3f' },
        tabBarActiveTintColor: '#7c5cff',
        tabBarInactiveTintColor: '#9eaccf',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{ title: 'Sammlung' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Einstellungen' }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { isLoggedIn } = useAuth();

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen
              name="Scan"
              component={ScanScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
