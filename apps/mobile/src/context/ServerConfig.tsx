import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = '@timps/serverUrl';
const DEFAULT_SERVER_URL = 'http://localhost:3000';

interface ServerConfigContextValue {
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
}

const ServerConfigContext = createContext<ServerConfigContextValue>({
  serverUrl: DEFAULT_SERVER_URL,
  setServerUrl: async () => {},
});

export function useServerUrl() {
  return useContext(ServerConfigContext);
}

export function ServerConfigProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrlState] = useState(DEFAULT_SERVER_URL);

  useEffect(() => {
    AsyncStorage.getItem(SERVER_URL_KEY).then((stored) => {
      if (stored) setServerUrlState(stored);
    });
  }, []);

  const setServerUrl = async (url: string) => {
    const trimmed = url.replace(/\/+$/, '');
    setServerUrlState(trimmed);
    await AsyncStorage.setItem(SERVER_URL_KEY, trimmed);
  };

  return (
    <ServerConfigContext.Provider value={{ serverUrl, setServerUrl }}>
      {children}
    </ServerConfigContext.Provider>
  );
}
