import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';

export const SUPPORTED_LANGUAGES = [
  { id: 'auto', label: 'Auto-Detect' },
  { id: 'code', label: 'Code' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'json', label: 'JSON' },
  { id: 'plaintext', label: 'Plain Text' },
];

export function detectLanguage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'plaintext';

  // Check JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Ignore
    }
  }

  // Check Markdown
  if (/^#{1,6}\s+|\n#{1,6}\s+|\[.+\]\(.+\)|```|\*\*[^*]+\*\*/m.test(trimmed)) {
    return 'markdown';
  }

  // Check Python
  if (/\b(def\s+\w+|import\s+\w+|from\s+\w+\s+import|elif\s+|print\(|self\.)\b/.test(trimmed)) {
    return 'python';
  }

  // Check SQL
  if (/\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE|DELETE\s+FROM)\b/i.test(trimmed)) {
    return 'sql';
  }

  // Check Bash
  if (trimmed.startsWith('#!/') || /\b(npm\s+(i|install|run|build)|git\s+(commit|push|pull|checkout)|curl\s+-|docker\s+run)\b/.test(trimmed)) {
    return 'bash';
  }

  // Check JS/TS
  if (/\b(const\s+\w+|let\s+\w+|function\s*\(|=>\s*\{?|interface\s+\w+|import\s+.*\s+from)\b/.test(trimmed)) {
    return 'javascript';
  }

  return 'plaintext';
}

export function highlightCode(code: string, language: string): string {
  let resolvedLang = language;
  if (language === 'auto') {
    resolvedLang = detectLanguage(code);
  } else if (language === 'code') {
    const detected = detectLanguage(code);
    resolvedLang = detected !== 'plaintext' ? detected : 'javascript';
  }

  const grammar = Prism.languages[resolvedLang] || Prism.languages.javascript || Prism.languages.plaintext;
  if (!grammar) {
    return escapeHtml(code);
  }
  try {
    return Prism.highlight(code, grammar, resolvedLang);
  } catch {
    return escapeHtml(code);
  }
}

export function getFileExtensionForLang(language: string): string {
  switch (language) {
    case 'json':
      return 'json';
    case 'markdown':
      return 'md';
    case 'code':
    case 'javascript':
      return 'js';
    case 'typescript':
      return 'ts';
    case 'python':
      return 'py';
    case 'sql':
      return 'sql';
    case 'bash':
      return 'sh';
    default:
      return 'txt';
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

