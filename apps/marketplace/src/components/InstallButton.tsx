'use client';

import { useState } from 'react';

export function InstallButton({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleInstall = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = command;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button onClick={handleInstall} className="btn btn-primary">
      {copied ? '✓ Copied!' : label}
    </button>
  );
}
