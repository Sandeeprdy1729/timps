import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Animated } from 'react-native';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';
import { useServerUrl } from '../context/ServerConfig';

type VoiceNav = NativeStackNavigationProp<RootStackParamList, 'Voice'>;

export function VoiceAssistantScreen() {
  const navigation = useNavigation<VoiceNav>();
  const { serverUrl } = useServerUrl();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [response, setResponse] = useState('');

  const barAnims = useRef([...Array(5)].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (listening) {
      const loops = barAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 300 + i * 80, useNativeDriver: false }),
            Animated.timing(anim, { toValue: 0.3, duration: 300 + i * 80, useNativeDriver: false }),
          ]),
        ),
      );
      Animated.parallel(loops).start();
      return () => loops.forEach((l) => l.stop());
    } else {
      barAnims.forEach((a) => a.setValue(0.3));
    }
  }, [listening, barAnims]);

  const processVoiceCommand = async (command: string) => {
    setSpeaking(true);
    try {
      const res = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command }),
      });
      const data = await res.json();
      const text = data.response || 'I\'m ready to help.';
      setResponse(text);
      speak(text);
    } catch {
      const fallback = 'I\'m here to help with your coding. Try typing your request.';
      setResponse(fallback);
      speak(fallback);
    } finally {
      setSpeaking(false);
    }
  };

  const speak = (text: string) => {
    setSpeaking(true);
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

  const handleSend = () => {
    const trimmed = textInput.trim();
    if (!trimmed || speaking) return;
    setLastTranscript(trimmed);
    setTextInput('');
    processVoiceCommand(trimmed);
  };

  const handleMicPress = () => {
    if (listening) {
      setListening(false);
      if (lastTranscript) {
        processVoiceCommand(lastTranscript);
      }
    } else {
      setListening(true);
      setLastTranscript('');
      setResponse('');
    }
  };

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.visualizer}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              listening && styles.barActive,
              { height: anim.interpolate({ inputRange: [0.3, 1], outputRange: [20, 80] }) },
            ]}
          />
        ))}
      </View>

      <Text style={styles.status}>
        {speaking ? 'Speaking...' : listening ? 'Listening (type below)...' : 'Ready'}
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

      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={textInput}
          onChangeText={setTextInput}
          placeholder="Type a message..."
          placeholderTextColor="#64748b"
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!textInput.trim() || speaking) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!textInput.trim() || speaking}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        {speaking ? (
          <TouchableOpacity style={styles.stopButton} onPress={stopSpeaking}>
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            onPress={handleMicPress}
          >
            <Text style={styles.micIcon}>{listening ? '⏹' : '🎤'}</Text>
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
  barActive: { backgroundColor: '#3b82f6' },
  status: { textAlign: 'center', fontSize: 16, color: '#94a3b8', marginTop: 24 },
  transcriptBox: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginTop: 24 },
  transcriptLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  transcriptText: { fontSize: 16, color: '#fff' },
  responseBox: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 },
  responseLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  responseText: { fontSize: 16, color: '#fff' },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  textInput: { flex: 1, padding: 12, fontSize: 16, backgroundColor: '#1e293b', borderRadius: 12, color: '#fff' },
  sendBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#3b82f6', borderRadius: 12, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#475569' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  controls: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 48 },
  micButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  micButtonActive: { backgroundColor: '#ef4444' },
  micIcon: { fontSize: 32 },
  stopButton: { paddingHorizontal: 32, paddingVertical: 16, backgroundColor: '#ef4444', borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
