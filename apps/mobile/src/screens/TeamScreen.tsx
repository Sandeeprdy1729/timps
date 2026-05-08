import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  lastActive?: number;
}

interface TeamStats {
  name: string;
  plan: string;
  members: number;
  apiCalls: number;
}

export function TeamScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));

    setStats({
      name: 'My Team',
      plan: 'Pro',
      members: 5,
      apiCalls: 12500,
    });

    setMembers([
      { id: '1', name: 'John Doe', email: 'john@example.com', role: 'owner', lastActive: Date.now() - 3600000 },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'admin', lastActive: Date.now() - 7200000 },
      { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'member', lastActive: Date.now() - 86400000 },
      { id: '4', name: 'Alice Brown', email: 'alice@example.com', role: 'member' },
    ]);

    setLoading(false);
  };

  const sendInvite = () => {
    if (!inviteEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    Alert.alert('Invite Sent', `Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
    setShowInvite(false);
  };

  const changeRole = (memberId: string, role: string) => {
    setMembers(members.map(m => 
      m.id === memberId ? { ...m, role: role as any } : m
    ));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return '#f59e0b';
      case 'admin': return '#3b82f6';
      case 'member': return '#22c55e';
      default: return '#64748b';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team</Text>
      </View>

      {stats && (
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{stats.name}</Text>
            <View style={[styles.planBadge, { backgroundColor: stats.plan === 'Enterprise' ? '#8b5cf620' : '#3b82f620' }]}>
              <Text style={[styles.planText, { color: '#8b5cf6' }]}>{stats.plan}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stats.members}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{(stats.apiCalls / 1000).toFixed(1)}K</Text>
              <Text style={styles.statLabel}>API Calls</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Members</Text>
        <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInvite(true)}>
          <Text style={styles.inviteButtonText}>+ Invite</Text>
        </TouchableOpacity>
      </View>

      {showInvite && (
        <View style={styles.inviteForm}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={sendInvite}>
              <Text style={styles.sendText}>Send Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {members.map((member) => (
        <View key={member.id} style={styles.memberCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberEmail}>{member.email}</Text>
            {member.lastActive && (
              <Text style={styles.lastActive}>Last active: {new Date(member.lastActive).toLocaleTimeString()}</Text>
            )}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) + '20' }]}>
            <Text style={[styles.roleText, { color: getRoleColor(member.role) }]}>{member.role}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  statsCard: { margin: 16, padding: 20, backgroundColor: '#f8fafc', borderRadius: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  planBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  planText: { fontSize: 12, fontWeight: '600' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#64748b' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  inviteButton: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  inviteButtonText: { color: '#fff', fontWeight: '600' },
  inviteForm: { margin: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12 },
  input: { padding: 12, backgroundColor: '#fff', borderRadius: 8, fontSize: 16, marginBottom: 12 },
  inviteActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '600' },
  sendBtn: { flex: 1, padding: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '600' },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberEmail: { fontSize: 13, color: '#64748b' },
  lastActive: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});