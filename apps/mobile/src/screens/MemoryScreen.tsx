import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';

interface MemoryEntry {
  id: string;
  type: 'fact' | 'pattern' | 'preference';
  content: string;
  tags: string[];
  timestamp: number;
}

export function MemoryScreen() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setEntries([
      { id: '1', type: 'fact', content: 'React hooks should follow use-prefix naming', tags: ['react', 'hooks'], timestamp: Date.now() - 86400000 },
      { id: '2', type: 'pattern', content: 'API routes go in src/api/', tags: ['architecture'], timestamp: Date.now() - 172800000 },
      { id: '3', type: 'preference', content: 'Prefer TypeScript over JavaScript', tags: ['preference'], timestamp: Date.now() - 259200000 },
    ]);
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesType = selectedType === 'all' || entry.type === selectedType;
    const matchesSearch = !searchQuery || entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search memories..."
        placeholderTextColor="#94a3b8"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.filter}>
        {['all', 'fact', 'pattern', 'preference'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterButton, selectedType === type && styles.filterButtonActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[styles.filterText, selectedType === type && styles.filterTextActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.entry}>
            <View style={styles.entryHeader}>
              <View style={[styles.typeBadge, { backgroundColor: item.type === 'fact' ? '#3b82f620' : item.type === 'pattern' ? '#22c55e20' : '#f59e0b20' }]}>
                <Text style={[styles.typeText, { color: item.type === 'fact' ? '#3b82f6' : item.type === 'pattern' ? '#22c55e' : '#f59e0b' }]}>
                  {item.type}
                </Text>
              </View>
              <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.content}>{item.content}</Text>
            <View style={styles.tags}>
              {item.tags.map((tag) => (
                <Text key={tag} style={styles.tag}> #{tag}</Text>
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  search: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, fontSize: 16, marginBottom: 16 },
  filter: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f8fafc', borderRadius: 20 },
  filterButtonActive: { backgroundColor: '#3b82f6' },
  filterText: { fontSize: 14, color: '#64748b' },
  filterTextActive: { color: '#fff' },
  entry: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  typeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  timestamp: { fontSize: 12, color: '#94a3b8' },
  content: { fontSize: 15, color: '#0f172a', marginBottom: 8 },
  tags: { flexDirection: 'row', gap: 8 },
  tag: { fontSize: 12, color: '#3b82f6' },
});