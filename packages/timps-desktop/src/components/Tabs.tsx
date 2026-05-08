/**
 * TIMPS Desktop - Tabs
 * Tab navigation component.
 */

import { useState } from 'react';
import './Tabs.css';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tab: string) => void;
  variant?: 'line' | 'pills' | 'enclosed';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'line' }: TabsProps) {
  return (
    <div className={`tabs tabs-${variant}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="tab-badge">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (id !== activeTab) return null;
  return <div className="tab-panel">{children}</div>;
}

interface AccordionProps {
  items: { id: string; label: string; content: React.ReactNode }[];
  allowMultiple?: boolean;
}

export function Accordion({ items, allowMultiple = false }: AccordionProps) {
  const [open, setOpen] = useState<string[]>([]);

  const toggle = (id: string) => {
    if (allowMultiple) {
      setOpen(prev => 
        prev.includes(id) 
          ? prev.filter(i => i !== id)
          : [...prev, id]
      );
    } else {
      setOpen(prev => prev.includes(id) ? [] : [id]);
    }
  };

  return (
    <div className="accordion">
      {items.map(item => (
        <div key={item.id} className={`accordion-item ${open.includes(item.id) ? 'open' : ''}`}>
          <button className="accordion-header" onClick={() => toggle(item.id)}>
            <span>{item.label}</span>
            <span className="accordion-arrow">▶</span>
          </button>
          {open.includes(item.id) && (
            <div className="accordion-content">{item.content}</div>
          )}
        </div>
      ))}
    </div>
  );
}

interface StepperProps {
  steps: string[];
  currentStep: number;
  onChange?: (step: number) => void;
}

export function Stepper({ steps, currentStep, onChange }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div 
          key={index} 
          className={`step ${index < currentStep ? 'completed' : ''} ${index === currentStep ? 'current' : ''}`}
          onClick={() => onChange?.(index)}
        >
          <div className="step-indicator">
            {index < currentStep ? '✓' : index + 1}
          </div>
          <span className="step-label">{step}</span>
          {index < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb">
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 && <span className="breadcrumb-sep">/</span>}
          {item.href ? (
            <a href={item.href}>{item.label}</a>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}