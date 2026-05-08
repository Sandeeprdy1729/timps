import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';

type VoiceNav = NativeStackNavigationProp<RootStackParamList, 'Voice'>;

export function VoiceAssistantScreen() {
  const navigation = useNavigation<VoiceNav>();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [response, setResponse] = useState('');

  const startListening = () => {
    setListening(true);
    setLastTranscript('');
  };

  const stopListening = () => {
    setListening(false);
    if (lastTranscript) {
      processVoiceCommand(lastTranscript);
    }
  };

  const processVoiceCommand = async (command: string) => {
    setSpeaking(true);
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command }),
      });
      const data = await response.json();
      const text = data.response || 'I\'m ready to help.';
      setResponse(text);
      speak(text);
    } catch (e) {
      const fallback = 'I\'m here to help with your coding. Try typing your request.';
      setResponse(fallback);
      speak(fallback);
    } finally {
      setSpeaking(false);
    }
  };

  const speak = (text: string) => {
    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setSpeaking(false),
    });
  };

  const stopSpeaking = () => {
    Speech.stop();
    setSpeaking(false);
  };

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.visualizer}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              listening && styles.barActive,
              { animationDelay: `${i * 0.1}s` },
            ]}
          />
        ))}
      </View>

      <Text style={styles.status}>
        {speaking ? 'Speaking...' : listening ? 'Listening...' : 'Ready'}
      </Text>

      {lastTranscript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcriptText}>{lastTranscript}</Text>
        </View>
      ) : null}

      {response ? (
        <View style={styles.responseBox}>
          <Text style={styles.responseLabel}>TIMPS:</Text>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        {speaking ? (
          <TouchableOpacity style={styles.stopButton} onPress={stopSpeaking}>
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            onPress={listening ? stopListening : startListening}
          >
            {speaking || listening ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.micIcon}>🎤</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  visualizer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', height: 120, gap: 8 },
  bar: { width: 8, height: 20, backgroundColor: '#334155', borderRadius: 4 },
  barActive: { backgroundColor: '#3b82f6', height: 80, animation: 'pulse 0.5s infinite' },
  status: { textAlign: 'center', fontSize: 16, color: '#94a3b8', marginTop: 24 },
  transcriptBox: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginTop: 24 },
  transcriptLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  transcriptText: { fontSize: 16, color: '#fff' },
  responseBox: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 },
  responseLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  responseText: { fontSize: 16, color: '#fff' },
  controls: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 48 },
  micButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  micButtonActive: { backgroundColor: '#ef4444' },
  micIcon: { fontSize: 32 },
  stopButton: { paddingHorizontal: 32, paddingVertical: 16, backgroundColor: '#ef4444', borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});