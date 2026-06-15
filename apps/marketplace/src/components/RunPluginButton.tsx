'use client';

import { useState } from 'react';

interface RunPluginButtonProps {
  pluginId: string;
  pluginName: string;
  configFields?: Array<{ key: string; label: string; type: string; placeholder: string }>;
}

export function RunPluginButton({ pluginId, pluginName, configFields }: RunPluginButtonProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  const handleRun = async (extraConfig?: Record<string, string>) => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = { config: {} };
      if (extraConfig) {
        payload.config = { params: extraConfig };
      }
      const res = await fetch(`/api/plugins/${pluginId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Plugin execution failed');
      } else {
        setResult(data.output || 'Plugin completed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setRunning(false);
    }
  };

  const fields = configFields || [];

  return (
    <div>
      {fields.length > 0 ? (
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <button onClick={() => setShowConfig(!showConfig)} className="btn btn-primary">
            {running ? 'Running...' : `Run ${pluginName}`}
          </button>
          {showConfig && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {fields.map((field) => (
                <input
                  key={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={configValues[field.key] || ''}
                  onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                  className="search-input"
                  style={{ padding: '12px 16px' }}
                />
              ))}
              <button onClick={() => handleRun(configValues)} className="btn btn-primary">
                Run with config
              </button>
              <button onClick={() => setShowConfig(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => handleRun()} disabled={running} className="btn btn-primary">
          {running ? 'Running...' : `Run ${pluginName}`}
        </button>
      )}
      {result && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--muted)', borderRadius: 'var(--radius)', fontSize: '14px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto' }}>
          {result}
        </div>
      )}
      {error && (
        <p style={{ marginTop: '8px', color: 'var(--error)', fontSize: '14px' }}>{error}</p>
      )}
    </div>
  );
}
