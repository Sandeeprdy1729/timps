import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Session {
  id: string;
  lastMessage: string;
  updatedAt: number;
  summary: string;
}

interface ActivityItem {
  id: string;
  type: 'chat' | 'memory' | 'integration';
  title: string;
  description: string;
  timestamp: number;
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const [loading, setLoading] = useState(true);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({ memories: 0, sessions: 0, integrations: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const storage = await import('@react-native-async-storage/async-storage').then(
        (m) => m.default
      );
      const sessionsJson = await storage.getItem('recent_sessions');
      const sessions = sessionsJson ? JSON.parse(sessionsJson) : [];
      setRecentSessions(sessions.slice(0, 5));

      setActivity([
        { id: '1', type: 'chat', title: 'Code review complete', description: 'Analyzed 3 files', timestamp: Date.now() - 300000 },
        { id: '2', type: 'memory', title: 'Pattern learned', description: 'React hooks conventions', timestamp: Date.now() - 600000 },
        { id: '3', type: 'integration', title: 'GitHub connected', description: 'Repository synced', timestamp: Date.now() - 900000 },
      ]);

      setStats({ memories: 42, sessions: sessions.length, integrations: 8 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const QuickAction = ({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Text style={[styles.quickActionIconText, { color }]}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.subtitle}>How can I help you code today?</Text>
      </View>

      <View style={styles.searchBox}>
        <TouchableOpacity onPress={() => navigation.navigate('Chat')}>
          <Text style={styles.searchPlaceholder}>Ask TIMPS...</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.voiceButton} onPress={() => navigation.navigate('Voice')}>
          <Text>🎤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <QuickAction icon="💬" label="Chat" color="#3b82f6" onPress={() => navigation.navigate('Chat')} />
        <QuickAction icon="🧠" label="Memory" color="#22c55e" onPress={() => navigation.navigate('Memory')} />
        <QuickAction icon="⚡" label="Workflows" color="#f59e0b" onPress={() => navigation.navigate('Workflows')} />
        <QuickAction icon="📊" label="Analytics" color="#8b5cf6" onPress={() => navigation.navigate('Analytics')} />
      </View>

      <View style={styles.quickActions}>
        <QuickAction icon="📝" label="Activity" color="#3b82f6" onPress={() => navigation.navigate('Activity')} />
        <QuickAction icon="👥" label="Team" color="#22c55e" onPress={() => navigation.navigate('Team')} />
        <QuickAction icon="🔌" label="Integrate" color="#8b5cf6" onPress={() => navigation.navigate('Integrations')} />
        <QuickAction icon="⚙️" label="Settings" color="#64748b" onPress={() => navigation.navigate('Settings')} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.memories}</Text>
          <Text style={styles.statLabel}>Memories</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.sessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.integrations}</Text>
          <Text style={styles.statLabel}>Integrations</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.emptyText}>No recent sessions</Text>
        ) : (
          recentSessions.map((session) => (
            <TouchableOpacity key={session.id} style={styles.sessionItem}>
              <Text style={styles.sessionTitle}>{session.summary || 'Chat Session'}</Text>
              <Text style={styles.sessionTime}>{new Date(session.updatedAt).toLocaleTimeString()}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        {activity.map((item) => (
          <View key={item.id} style={styles.activityItem}>
            <View style={[styles.activityIcon, { backgroundColor: item.type === 'chat' ? '#3b82f620' : item.type === 'memory' ? '#22c55e20' : '#8b5cf620' }]}>
              <Text>{item.type === 'chat' ? '💬' : item.type === 'memory' ? '🧠' : '🔌'}</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityDesc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 10 },
  greeting: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },
  searchBox: { flexDirection: 'row', margin: 16, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center' },
  searchPlaceholder: { flex: 1, fontSize: 16, color: '#94a3b8' },
  voiceButton: { padding: 8 },
  quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
  quickAction: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
  quickActionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickActionIconText: { fontSize: 20 },
  quickActionLabel: { fontSize: 12, color: '#64748b' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  stat: { flex: 1, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontStyle: 'italic' },
  sessionItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8 },
  sessionTitle: { fontSize: 14, color: '#0f172a' },
  sessionTime: { fontSize: 12, color: '#94a3b8' },
  activityItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  activityIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  activityDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
});