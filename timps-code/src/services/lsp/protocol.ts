// TIMPS LSP — Protocol types (LSP JSON-RPC 2.0 subset)

export interface LspMessage {
  jsonrpc: '2.0';
}

export interface LspRequest extends LspMessage {
  id: number;
  method: string;
  params?: unknown;
}

export interface LspResponse extends LspMessage {
  id: number;
  result?: unknown;
  error?: LspError;
}

export interface LspNotification extends LspMessage {
  method: string;
  params?: unknown;
}

export interface LspError {
  code: number;
  message: string;
  data?: unknown;
}

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspLocationLink {
  originSelectionRange?: LspRange;
  targetUri: string;
  targetRange: LspRange;
  targetSelectionRange: LspRange;
}

export type LspDefinitionResult = LspLocation | LspLocation[] | LspLocationLink[] | null;

export interface LspHover {
  contents: LspMarkupContent | LspMarkedString | LspMarkedString[];
  range?: LspRange;
}

export type LspMarkedString = string | { language: string; value: string };

export interface LspMarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

export interface LspDiagnostic {
  range: LspRange;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  tags?: DiagnosticTag[];
  data?: unknown;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export enum DiagnosticTag {
  Unnecessary = 1,
  Deprecated = 2,
}

export interface LspTextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface LspTextDocumentIdentifier {
  uri: string;
}

export interface LspVersionedTextDocumentIdentifier extends LspTextDocumentIdentifier {
  version: number;
}

export interface LspDidOpenParams {
  textDocument: LspTextDocumentItem;
}

export interface LspDidChangeParams {
  textDocument: LspVersionedTextDocumentIdentifier;
  contentChanges: { range?: LspRange; rangeLength?: number; text: string }[];
}

export interface LspDidCloseParams {
  textDocument: LspTextDocumentIdentifier;
}

export interface LspDidSaveParams {
  textDocument: LspTextDocumentIdentifier;
  text?: string;
}

export interface LspDefinitionParams {
  textDocument: LspTextDocumentIdentifier;
  position: LspPosition;
}

export interface LspHoverParams {
  textDocument: LspTextDocumentIdentifier;
  position: LspPosition;
}

export interface LspPublishDiagnosticsParams {
  uri: string;
  diagnostics: LspDiagnostic[];
  version?: number;
}

export interface LspInitializeParams {
  processId: number | null;
  rootUri: string | null;
  capabilities: Record<string, unknown>;
}

export interface LspServerCapabilities {
  textDocumentSync?: number | TextDocumentSyncOptions;
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  diagnosticProvider?: DiagnosticOptions;
  [key: string]: unknown;
}

export interface TextDocumentSyncOptions {
  openClose?: boolean;
  change?: number;
  willSave?: boolean;
  willSaveWaitUntil?: boolean;
  save?: boolean | { includeText?: boolean };
}

export interface DiagnosticOptions {
  identifier?: string;
  interFileDependencies?: boolean;
  workspaceDiagnostics?: boolean;
}

export enum TextDocumentSyncKind {
  None = 0,
  Full = 1,
  Incremental = 2,
}

export function encodeLspMessage(msg: LspRequest | LspResponse | LspNotification): string {
  const json = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n${json}`;
}

export function decodeLspMessages(data: string): (LspRequest | LspResponse | LspNotification)[] {
  const messages: (LspRequest | LspResponse | LspNotification)[] = [];
  const parts = data.split('\r\n\r\n');
  for (let i = 0; i < parts.length - 1; i++) {
    const header = parts[i];
    const body = parts[i + 1];
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (lengthMatch) {
      const length = parseInt(lengthMatch[1], 10);
      if (body.length >= length) {
        try {
          messages.push(JSON.parse(body.substring(0, length)));
        } catch {
          // skip malformed
        }
      }
    }
  }
  return messages;
}
