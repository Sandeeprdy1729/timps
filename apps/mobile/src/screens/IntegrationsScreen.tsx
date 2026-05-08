import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Switch } from 'react-native';

interface Integration {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected';
  lastSync?: number;
}

export function IntegrationsScreen() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    setIntegrations([
      { id: 'github', name: 'GitHub', icon: '🐙', status: 'connected', lastSync: Date.now() - 3600000 },
      { id: 'slack', name: 'Slack', icon: '💬', status: 'connected' },
      { id: 'notion', name: 'Notion', icon: '📝', status: 'disconnected' },
      { id: 'linear', name: 'Linear', icon: '📋', status: 'connected', lastSync: Date.now() - 7200000 },
      { id: 'vercel', name: 'Vercel', icon: '▲', status: 'disconnected' },
      { id: 'jira', name: 'Jira', icon: '📊', status: 'disconnected' },
    ]);
  }, []);

  const toggleConnection = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? { ...i, status: i.status === 'connected' ? 'disconnected' : 'connected', lastSync: i.status === 'disconnected' ? Date.now() : undefined }
          : i
      )
    );
  };

  const connectedCount = integrations.filter((i) => i.status === 'connected').length;

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <Text style={styles.statsText}>{connectedCount} of {integrations.length} connected</Text>
      </View>

      <FlatList
        data={integrations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.integration}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.status}>
                {item.status === 'connected' ? item.lastSync ? `Last sync: ${new Date(item.lastSync).toLocaleTimeString()}` : 'Connected' : 'Not connected'}
              </Text>
            </View>
            <Switch
              value={item.status === 'connected'}
              onValueChange={() => toggleConnection(item.id)}
              trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
            />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  stats: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 16 },
  statsText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  integration: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500', color: '#0f172a' },
  status: { fontSize: 12, color: '#64748b', marginTop: 2 },
});