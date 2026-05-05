// Shims for optional heavy dependencies that may not be installed
declare module 'puppeteer' {
  export const launch: (...args: unknown[]) => Promise<unknown>;
  export const connect: (...args: unknown[]) => Promise<unknown>;
  export default { launch, connect };
}

declare module 'pdf-parse' {
  function pdfParse(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<{
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }>;
  export = pdfParse;
}

declare module 'ink-text-input' {
  import type * as React from 'react';
  interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
    focus?: boolean;
    mask?: string;
  }
  const TextInput: React.FC<TextInputProps>;
  export default TextInput;
}

declare module 'ink-spinner' {
  import type * as React from 'react';
  interface SpinnerProps { type?: string; }
  const Spinner: React.FC<SpinnerProps>;
  export default Spinner;
}
