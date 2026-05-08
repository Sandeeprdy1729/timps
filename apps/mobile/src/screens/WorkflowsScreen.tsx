import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'enabled' | 'disabled';
  lastRun?: number;
  runCount: number;
}

export function WorkflowsScreen() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setWorkflows([
      { id: '1', name: 'Daily Standup', description: 'Send daily standup reminders', status: 'enabled', lastRun: Date.now() - 3600000, runCount: 30 },
      { id: '2', name: 'Git Sync', description: 'Sync on git push', status: 'enabled', runCount: 150 },
      { id: '3', name: 'Weekly Report', description: 'Generate weekly metrics', status: 'disabled', runCount: 12 },
    ]);
  };

  const createWorkflow = () => {
    if (!newName.trim()) return;
    const newWorkflow: Workflow = {
      id: Date.now().toString(),
      name: newName,
      description: newDesc,
      status: 'disabled',
      runCount: 0,
    };
    setWorkflows([...workflows, newWorkflow]);
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const toggleWorkflow = (id: string) => {
    setWorkflows(workflows.map(w =>
      w.id === id ? { ...w, status: w.status === 'enabled' ? 'disabled' : 'enabled' } : w
    ));
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows(workflows.filter(w => w.id !== id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workflows</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {showCreate && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.input}
            placeholder="Workflow name"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            value={newDesc}
            onChangeText={setNewDesc}
            multiline
          />
          <View style={styles.createActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={createWorkflow}>
              <Text style={styles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={workflows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.workflowItem}>
            <View style={styles.workflowInfo}>
              <View style={styles.workflowHeader}>
                <Text style={styles.workflowName}>{item.name}</Text>
                <View style={[styles.statusBadge, item.status === 'enabled' ? styles.enabled : styles.disabled]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.workflowDesc}>{item.description}</Text>
              <Text style={styles.workflowMeta}>
                {item.runCount} runs • Last run: {item.lastRun ? new Date(item.lastRun).toLocaleTimeString() : 'Never'}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 24 },
  createForm: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16 },
  input: { padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  createActions: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 12, backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '600' },
  createButton: { flex: 1, padding: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '600' },
  workflowItem: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  workflowInfo: { flex: 1 },
  workflowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  workflowName: { fontSize: 16, fontWeight: '600', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  enabled: { backgroundColor: '#22c55e20' },
  disabled: { backgroundColor: '#64748b20' },
  statusText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  workflowDesc: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  workflowMeta: { fontSize: 12, color: '#94a3b8' },
});