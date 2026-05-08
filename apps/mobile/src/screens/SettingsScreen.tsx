import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ScrollView, Alert } from 'react-native';

export function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleReset = () => {
    Alert.alert('Reset Settings', 'Reset all settings to default?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => {} },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server</Text>
        <View style={styles.setting}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://localhost:3000"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.setting}>
          <Text style={styles.label}>Auto-sync</Text>
          <Switch value={autoSync} onValueChange={setAutoSync} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.setting}>
          <Text style={styles.label}>Push notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.setting}>
          <Text style={styles.label}>Dark mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
          <Text style={styles.dangerText}>Reset all settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>TIMPS Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 12, textTransform: 'uppercase' },
  setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 16, color: '#0f172a' },
  input: { flex: 1, padding: 8, marginLeft: 16, backgroundColor: '#f8fafc', borderRadius: 8 },
  dangerButton: { padding: 16, backgroundColor: '#fee2e2', borderRadius: 12, alignItems: 'center' },
  dangerText: { color: '#ef4444', fontWeight: '600' },
  footer: { padding: 24, alignItems: 'center' },
  version: { fontSize: 14, color: '#94a3b8' },
});