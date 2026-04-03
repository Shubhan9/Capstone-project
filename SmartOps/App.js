import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { StatusBar } from 'expo-status-bar';
import { initApp } from './src/database/appInit';

import database from './src/database';
import { colors } from './src/theme';
import { logoutAndSync } from './src/sync/syncEngine';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewOrderScreen from './src/screens/NewOrderScreen';
import StockInScreen from './src/screens/StockInScreen';
import ProductRegistrationScreen from './src/screens/ProductRegistrationScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    initApp();
  }, []);
  const [authed, setAuthed] = useState(false);

  function handleLogin(token, business) {
    setAuthed(true);
  }

  async function handleLogout() {
    // Final sync push before credentials are wiped
    await logoutAndSync();
    setAuthed(false);
  }

  if (!authed) {
    return (
      <DatabaseProvider database={database}>
        <StatusBar style="light" />
        <LoginScreen onLogin={handleLogin} />
      </DatabaseProvider>
    );
  }

  return (
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home">
            {props => <HomeScreen {...props} onLogout={handleLogout} />}
          </Stack.Screen>
          <Stack.Screen name="NewOrder" component={NewOrderScreen} />
          <Stack.Screen name="StockIn" component={StockInScreen} />
          <Stack.Screen name="ProductRegistration" component={ProductRegistrationScreen} />
          <Stack.Screen name="Alerts" component={AlertsScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>
  );
}