import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';

interface Activity {
  id: string;
  type: 'workflow' | 'chat' | 'memory' | 'integration' | 'team';
  title: string;
  description: string;
  timestamp: number;
  user?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
}

export function ActivityScreen() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedTab, setSelectedTab] = useState<'activity' | 'notifications'>('activity');

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    setActivities([
      { id: '1', type: 'workflow', title: 'Daily workflow completed', description: 'Git Sync workflow ran successfully', timestamp: Date.now() - 300000 },
      { id: '2', type: 'chat', title: 'Code review session', description: 'Analyzed 3 files', timestamp: Date.now() - 600000 },
      { id: '3', type: 'memory', title: 'New pattern learned', description: 'React hooks conventions', timestamp: Date.now() - 900000 },
      { id: '4', type: 'integration', title: 'GitHub connected', description: 'Repository synced', timestamp: Date.now() - 1200000 },
      { id: '5', type: 'team', title: 'Member joined', description: 'john@example.com joined the team', timestamp: Date.now() - 1800000 },
    ]);

    setNotifications([
      { id: '1', title: 'Workflow completed', message: 'Git Sync completed successfully', read: false, timestamp: Date.now() - 300000 },
      { id: '2', title: 'New member', message: 'john@example.com joined the team', read: false, timestamp: Date.now() - 1800000 },
      { id: '3', title: 'Memory limit', message: 'You\'ve used 80% of your memory', read: true, timestamp: Date.now() - 3600000 },
    ]);
  };

  const markRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'workflow': return '⚡';
      case 'chat': return '💬';
      case 'memory': return '🧠';
      case 'integration': return '🔌';
      case 'team': return '👥';
      default: return '📌';
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'activity' && styles.activeTab]} 
          onPress={() => setSelectedTab('activity')}
        >
          <Text style={[styles.tabText, selectedTab === 'activity' && styles.activeTabText]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'notifications' && styles.activeTab]} 
          onPress={() => setSelectedTab('notifications')}
        >
          <Text style={[styles.tabText, selectedTab === 'notifications' && styles.activeTabText]}>
            Notifications {unreadCount > 0 && <Text style={styles.badge}>{unreadCount}</Text>}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'activity' ? (
        <View style={styles.list}>
          {activities.map((activity) => (
            <View key={activity.id} style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: activity.type === 'workflow' ? '#3b82f620' : activity.type === 'memory' ? '#22c55e20' : '#8b5cf620' }]}>
                <Text style={styles.icon}>{getIcon(activity.type)}</Text>
              </View>
              <View style={styles.content}>
                <Text style={styles.itemTitle}>{activity.title}</Text>
                <Text style={styles.itemDesc}>{activity.description}</Text>
                <Text style={styles.time}>{formatTime(activity.timestamp)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <TouchableOpacity 
              key={notification.id} 
              style={[styles.item, !notification.read && styles.unread]}
              onPress={() => markRead(notification.id)}
            >
              <View style={styles.content}>
                <Text style={[styles.itemTitle, !notification.read && styles.unreadTitle]}>{notification.title}</Text>
                <Text style={styles.itemDesc}>{notification.message}</Text>
                <Text style={styles.time}>{formatTime(notification.timestamp)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  activeTab: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  activeTabText: { color: '#fff' },
  badge: { backgroundColor: '#ef4444', color: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontSize: 10, marginLeft: 4 },
  list: { paddingHorizontal: 16 },
  item: { flexDirection: 'row', padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  unread: { backgroundColor: '#eff6ff', borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  icon: { fontSize: 18 },
  content: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  unreadTitle: { color: '#0f172a' },
  itemDesc: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  time: { fontSize: 12, color: '#94a3b8' },
});