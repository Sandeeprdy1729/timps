import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';

type ChatNav = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function ChatScreen() {
  const navigation = useNavigation<ChatNav>();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    setMessages([
      { id: '1', role: 'assistant', content: 'Hello! I\'m TIMPS, your AI coding assistant that remembers. How can I help you today?', timestamp: Date.now() },
    ]);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: messages }),
      });
      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I\'m ready to help. What would you like to do?',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I\'m running in standalone mode. What would you like me to help with?',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.messageText, item.role === 'user' ? styles.userText : styles.assistantText]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        style={styles.messages}
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
          placeholderTextColor="#94a3b8"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]} onPress={sendMessage} disabled={!input.trim() || loading}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  messages: { flex: 1 },
  messageList: { padding: 16 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#3b82f6' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  assistantText: { color: '#0f172a' },
  loading: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#64748b' },
  inputContainer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  input: { flex: 1, padding: 12, fontSize: 16, backgroundColor: '#f8fafc', borderRadius: 12, maxHeight: 100 },
  sendButton: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#3b82f6', borderRadius: 12, justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#94a3b8' },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});