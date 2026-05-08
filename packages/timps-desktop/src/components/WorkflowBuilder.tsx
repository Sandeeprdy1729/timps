import React, { useState } from 'react';
import { WorkflowEngine, Workflow, WorkflowStep } from '@timps/workflow-engine';

interface WorkflowBuilderProps {
  engine: WorkflowEngine;
  workflowId?: string;
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
}

export function WorkflowBuilder({ engine, workflowId, onSave, onCancel }: WorkflowBuilderProps) {
  const existing = workflowId ? engine.getWorkflow(workflowId) : null;
  
  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [triggerType, setTriggerType] = useState<'schedule' | 'event' | 'webhook' | 'manual'>(
    existing?.trigger.type || 'manual'
  );
  const [triggerConfig, setTriggerConfig] = useState(existing?.trigger.config || {});
  const [steps, setSteps] = useState<WorkflowStep[]>(existing?.steps || []);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      action: { type: 'notification', config: {} },
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(
      steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
    if (selectedStep === stepId) {
      setSelectedStep(null);
    }
  };

  const saveWorkflow = () => {
    const workflow = engine.createWorkflow({
      name,
      description,
      enabled: true,
      trigger: { type: triggerType, config: triggerConfig },
      steps,
    });
    onSave(workflow);
  };

  return (
    <div className="workflow-builder">
      <div className="builder-header">
        <h2>{workflowId ? 'Edit' : 'Create'} Workflow</h2>
        <button className="btn-close" onClick={onCancel}>×</button>
      </div>

      <div className="builder-body">
        <div className="builder-sidebar">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
            />
          </div>

          <div className="form-group">
            <label>Trigger</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as any)}
            >
              <option value="manual">Manual</option>
              <option value="event">Event</option>
              <option value="schedule">Schedule</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>

          {triggerType === 'event' && (
            <div className="form-group">
              <label>Event Name</label>
              <input
                type="text"
                value={triggerConfig.event || ''}
                onChange={(e) =>
                  setTriggerConfig({ ...triggerConfig, event: e.target.value })
                }
                placeholder="github.push"
              />
            </div>
          )}

          {triggerType === 'schedule' && (
            <div className="form-group">
              <label>Cron Expression</label>
              <input
                type="text"
                value={triggerConfig.cron || ''}
                onChange={(e) =>
                  setTriggerConfig({ ...triggerConfig, cron: e.target.value })
                }
                placeholder="0 * * * *"
              />
            </div>
          )}

          <div className="steps-section">
            <div className="steps-header">
              <h3>Steps</h3>
              <button className="btn-add" onClick={addStep}>+ Add Step</button>
            </div>

            <div className="steps-list">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`step-item ${selectedStep === step.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStep(step.id)}
                >
                  <span className="step-number">{index + 1}</span>
                  <span className="step-name">{step.name}</span>
                  <span className="step-type">{step.action.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="builder-canvas">
          {selectedStep ? (
            <StepEditor
              step={steps.find((s) => s.id === selectedStep)!}
              onUpdate={(updates) => updateStep(selectedStep, updates)}
              onDelete={() => removeStep(selectedStep)}
            />
          ) : (
            <div className="canvas-placeholder">
              Click a step to edit, or add a new one
            </div>
          )}
        </div>
      </div>

      <div className="builder-footer">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={saveWorkflow} disabled={!name}>
          Save Workflow
        </button>
      </div>
    </div>
  );
}

interface StepEditorProps {
  step: WorkflowStep;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onDelete: () => void;
}

function StepEditor({ step, onUpdate, onDelete }: StepEditorProps) {
  const [name, setName] = useState(step.name);
  const [actionType, setActionType] = useState(step.action.type);
  const [config, setConfig] = useState(step.action.config);

  return (
    <div className="step-editor">
      <div className="form-group">
        <label>Step Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onUpdate({ name: e.target.value });
          }}
        />
      </div>

      <div className="form-group">
        <label>Action Type</label>
        <select
          value={actionType}
          onChange={(e) => {
            setActionType(e.target.value as any);
            onUpdate({ action: { type: e.target.value as any, config: {} } });
          }}
        >
          <option value="notification">Notification</option>
          <option value="api_call">API Call</option>
          <option value="integration">Integration</option>
          <option value="transform">Transform</option>
          <option value="condition">Condition</option>
        </select>
      </div>

      {actionType === 'notification' && (
        <div className="form-group">
          <label>Message</label>
          <input
            type="text"
            value={config.message || ''}
            onChange={(e) => {
              setConfig({ ...config, message: e.target.value });
              onUpdate({ action: { type: 'notification', config: { message: e.target.value } } });
            }}
          />
        </div>
      )}

      {actionType === 'api_call' && (
        <>
          <div className="form-group">
            <label>URL</label>
            <input
              type="text"
              value={config.url || ''}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Method</label>
            <select
              value={config.method || 'GET'}
              onChange={(e) => setConfig({ ...config, method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </>
      )}

      {actionType === 'integration' && (
        <>
          <div className="form-group">
            <label>Integration</label>
            <input
              type="text"
              value={config.integration || ''}
              onChange={(e) => setConfig({ ...config, integration: e.target.value })}
              placeholder="github, slack, notion..."
            />
          </div>
          <div className="form-group">
            <label>Action</label>
            <input
              type="text"
              value={config.action || ''}
              onChange={(e) => setConfig({ ...config, action: e.target.value })}
              placeholder="create_issue, send_message..."
            />
          </div>
        </>
      )}

      <button className="btn-danger" onClick={onDelete}>
        Delete Step
      </button>
    </div>
  );
}

export function WorkflowList({ engine }: { engine: WorkflowEngine }) {
  const [workflows, setWorkflows] = useState(() => engine.listWorkflows());

  const toggleWorkflow = (id: string, enabled: boolean) => {
    if (enabled) {
      engine.enableWorkflow(id);
    } else {
      engine.disableWorkflow(id);
    }
    setWorkflows(engine.listWorkflows());
  };

  const runWorkflow = async (id: string) => {
    await engine.runWorkflow(id);
    setWorkflows(engine.listWorkflows());
  };

  return (
    <div className="workflow-list">
      <h2>Workflows</h2>
      {workflows.length === 0 ? (
        <p className="empty">No workflows yet. Create one to get started.</p>
      ) : (
        <div className="workflows">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="workflow-item">
              <div className="workflow-info">
                <h3>{workflow.name}</h3>
                <p>{workflow.description}</p>
                <div className="workflow-meta">
                  <span className={`status ${workflow.enabled ? 'enabled' : 'disabled'}`}>
                    {workflow.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span>{workflow.runs} runs</span>
                </div>
              </div>
              <div className="workflow-actions">
                <button onClick={() => runWorkflow(workflow.id)}>Run</button>
                <button onClick={() => toggleWorkflow(workflow.id, !workflow.enabled)}>
                  {workflow.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}