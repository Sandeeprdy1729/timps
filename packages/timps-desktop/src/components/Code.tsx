/**
 * TIMPS Desktop - Code
 * Code display and editor components.
 */

import './Code.css';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language, showLineNumbers }: CodeBlockProps) {
  const lines = code.split('\n');
  
  return (
    <div className="code-block">
      {language && <div className="code-language">{language}</div>}
      <pre>
        <code>
          {lines.map((line, index) => (
            <div key={index} className="code-line">
              {showLineNumbers && <span className="line-number">{index + 1}</span>}
              <span className="line-content">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
}

export function CodeEditor({ value, onChange, language, readOnly }: CodeEditorProps) {
  return (
    <textarea
      className="code-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
      spellCheck={false}
      readOnly={readOnly}
    />
  );
}

interface SyntaxHighlightProps {
  code: string;
  language: string;
}

const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export'];
const types = ['string', 'number', 'boolean', 'void', 'any', 'null', 'undefined'];

export function SyntaxHighlight({ code, language }: SyntaxHighlightProps) {
  let html = code;
  
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  
  for (const keyword of keywords) {
    html = html.replace(new RegExp(`\\b${keyword}\\b`, 'g'), `<span class="kw">${keyword}</span>`);
  }
  
  return (
    <pre className="syntax-highlight">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}