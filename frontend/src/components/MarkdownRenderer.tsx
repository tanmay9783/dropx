import React from 'react';
import { highlightCode } from '../utils/codeHighlighter';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced Code Block start/end
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Closing block
        const codeText = codeBlockLines.join('\n');
        const highlighted = highlightCode(codeText, codeBlockLang || 'plaintext');
        elements.push(
          <div key={`code-block-${i}`} className="my-2 rounded-xl bg-slate-950 p-3 border border-slate-800 overflow-x-auto text-xs font-mono">
            {codeBlockLang && (
              <span className="text-[10px] uppercase font-bold text-yellow-400/80 mb-1 block">
                {codeBlockLang}
              </span>
            )}
            <pre className="m-0 leading-relaxed">
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.replace('```', '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-xs font-bold text-yellow-400 mt-2 mb-1">
          {renderInlineFormatting(line.replace('### ', ''))}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="text-sm font-bold text-white mt-2.5 mb-1 border-b border-slate-800 pb-0.5">
          {renderInlineFormatting(line.replace('## ', ''))}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="text-base font-black text-white mt-3 mb-1.5 border-b border-slate-800 pb-1">
          {renderInlineFormatting(line.replace('# ', ''))}
        </h2>
      );
    } else if (line.startsWith('> ')) {
      // Blockquote
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-2 border-yellow-400 pl-3 py-0.5 my-1.5 text-xs text-slate-300 italic bg-yellow-500/5 rounded-r">
          {renderInlineFormatting(line.replace('> ', ''))}
        </blockquote>
      );
    } else if (/^[-*]\s+/.test(line)) {
      // Bullet list item
      elements.push(
        <li key={`li-${i}`} className="text-xs text-slate-300 ml-4 list-disc my-0.5">
          {renderInlineFormatting(line.replace(/^[-*]\s+/, ''))}
        </li>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      // Ordered list item
      elements.push(
        <li key={`oli-${i}`} className="text-xs text-slate-300 ml-4 list-decimal my-0.5">
          {renderInlineFormatting(line.replace(/^\d+\.\s+/, ''))}
        </li>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={`empty-${i}`} className="h-1.5" />);
    } else {
      // Paragraph
      elements.push(
        <p key={`p-${i}`} className="text-xs text-slate-300 leading-relaxed my-0.5">
          {renderInlineFormatting(line)}
        </p>
      );
    }
  }

  // Handle unclosed code block if any
  if (inCodeBlock && codeBlockLines.length > 0) {
    const codeText = codeBlockLines.join('\n');
    elements.push(
      <div key="unclosed-code" className="my-2 rounded-xl bg-slate-950 p-3 border border-slate-800 overflow-x-auto text-xs font-mono">
        <pre className="m-0 leading-relaxed">
          <code>{codeText}</code>
        </pre>
      </div>
    );
  }

  return <div className="markdown-body space-y-0.5">{elements}</div>;
};

function renderInlineFormatting(text: string): React.ReactNode {
  // Replace links [text](url), bold **text**, and inline code `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`)/;

  while (remaining) {
    const match = remaining.match(regex);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) {
      parts.push(remaining.substring(0, match.index));
    }

    const token = match[0];
    if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={`link-${keyIdx++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 underline hover:text-yellow-300"
          >
            {linkMatch[1]}
          </a>
        );
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-yellow-300 font-mono text-[11px] border border-slate-700"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(token);
    }

    remaining = remaining.substring(match.index + token.length);
  }

  return <>{parts}</>;
}
