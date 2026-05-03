import React, { createContext, useCallback, useContext, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

interface AuthContextValue {
  isLoggedIn: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({
  children,
  initialLoggedIn,
}: {
  children: React.ReactNode;
  initialLoggedIn: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);

  const login = useCallback(async (token: string) => {
    await SecureStore.setItemAsync('auth_token', token);
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('auth_token');
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
