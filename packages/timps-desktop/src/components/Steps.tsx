import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import './Steps.css';

export interface Step {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export interface StepsProps {
  steps: Step[];
  current?: number;
  onChange?: (index: number) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function Steps({
  steps,
  current = 0,
  onChange,
  direction = 'horizontal',
  className = '',
}: StepsProps) {
  const [currentStep, setCurrentStep] = useState(current);

  useEffect(() => {
    setCurrentStep(current);
  }, [current]);

  const handleStepClick = useCallback((index: number) => {
    setCurrentStep(index);
    onChange?.(index);
  }, [onChange]);

  return (
    <div className={`steps steps-${direction} ${className}`}>
      {steps.map((step, index) => (
        <div
          key={index}
          className={`step ${index <= currentStep ? 'completed' : ''} ${index === currentStep ? 'current' : ''} ${index < currentStep ? 'clickable' : ''}`}
          onClick={() => index < currentStep && handleStepClick(index)}
        >
          <div className="step-indicator">
            {step.icon || (
              <span className="step-number">
                {index < currentStep ? '✓' : index + 1}
              </span>
            )}
          </div>
          <div className="step-content">
            <div className="step-title">{step.title}</div>
            {step.description && (
              <div className="step-description">{step.description}</div>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className="step-line" />
          )}
        </div>
      ))}
    </div>
  );
}

export interface StepperProps {
  children: ReactNode;
  activeStep?: number;
  className?: string;
}

export function Stepper({ children, activeStep = 0, className = '' }: StepperProps) {
  const childArray = React.Children.toArray(children);
  const childCount = childArray.length;

  return (
    <div className={`stepper ${className}`}>
      <div className="stepper-progress">
        <div
          className="stepper-fill"
          style={{ width: `${((activeStep + 1) / childCount) * 100}%` }}
        />
      </div>
      <div className="stepper-content">
        {childArray.map((child, index) => (
          <div
            key={index}
            className={`stepper-step ${index === activeStep ? 'active' : index < activeStep ? 'completed' : 'pending'}`}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Steps;