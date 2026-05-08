import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

interface Metric {
  label: string;
  value: number;
  change: number;
  unit: string;
}

interface DailyData {
  day: string;
  apiCalls: number;
  tokens: number;
}

export function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [usageData, setUsageData] = useState<DailyData[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    
    setMetrics([
      { label: 'API Calls', value: 12500, change: 12.5, unit: '' },
      { label: 'Tokens Used', value: 2.4, change: 8.2, unit: 'M' },
      { label: 'Active Users', value: 42, change: -2.1, unit: '' },
      { label: 'Storage', value: 156, change: 5.3, unit: 'MB' },
      { label: 'Workflows Run', value: 892, change: 22.1, unit: '' },
      { label: 'Integrations', value: 18, change: 0, unit: '' },
    ]);

    setUsageData([
      { day: 'Mon', apiCalls: 1200, tokens: 180 },
      { day: 'Tue', apiCalls: 1500, tokens: 220 },
      { day: 'Wed', apiCalls: 1100, tokens: 160 },
      { day: 'Thu', apiCalls: 1800, tokens: 270 },
      { day: 'Fri', apiCalls: 2200, tokens: 330 },
      { day: 'Sat', apiCalls: 800, tokens: 120 },
      { day: 'Sun', apiCalls: 600, tokens: 90 },
    ]);

    setLoading(false);
  };

  const maxApiCalls = Math.max(...usageData.map(d => d.apiCalls));

  const MetricCard = ({ metric }: { metric: Metric }) => (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>
        {metric.value}{metric.unit}
      </Text>
      <View style={[styles.changeBadge, metric.change >= 0 ? styles.positive : styles.negative]}>
        <Text style={[styles.changeText, metric.change >= 0 ? styles.positiveText : styles.negativeText]}>
          {metric.change >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Last 7 days</Text>
      </View>

      <View style={styles.metricsGrid}>
        {metrics.map((m, i) => (
          <MetricCard key={i} metric={m} />
        ))}
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>API Calls</Text>
        <View style={styles.chart}>
          {usageData.map((d, i) => (
            <View key={i} style={styles.chartBar}>
              <View 
                style={[
                  styles.bar, 
                  { height: `${(d.apiCalls / maxApiCalls) * 100}%` }
                ]} 
              />
              <Text style={styles.barLabel}>{d.day}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  metricsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 12, 
    gap: 12 
  },
  metricCard: { 
    width: (Dimensions.get('window').width - 56) / 2, 
    padding: 16, 
    backgroundColor: '#f8fafc', 
    borderRadius: 12 
  },
  metricLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  changeBadge: { 
    position: 'absolute', 
    top: 12, 
    right: 12, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  positive: { backgroundColor: '#22c55e20' },
  negative: { backgroundColor: '#ef444420' },
  changeText: { fontSize: 12, fontWeight: '500' },
  positiveText: { color: '#22c55e' },
  negativeText: { color: '#ef4444' },
  chartSection: { padding: 16, marginTop: 16 },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  chart: { 
    flexDirection: 'row', 
    height: 150, 
    alignItems: 'flex-end', 
    gap: 12,
    paddingLeft: 8 
  },
  chartBar: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: '#3b82f6', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
});