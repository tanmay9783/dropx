import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  Trash2, 
  Send, 
  Code2, 
  Lock, 
  Download, 
  Sparkles, 
  Eye, 
  Edit3, 
  Wand2,
  ChevronDown
} from 'lucide-react';
import { TextSnippet, getSnippets, createSnippet, deleteSnippet } from '../services/api';
import { encryptText, decryptText } from '../utils/crypto';
import { 
  detectLanguage, 
  highlightCode, 
  getFileExtensionForLang, 
  SUPPORTED_LANGUAGES 
} from '../utils/codeHighlighter';
import { MarkdownRenderer } from './MarkdownRenderer';

interface TextSnippetsProps {
  roomCode: string;
  socketToken: string;
  roomKey?: string | null;
  newSnippet?: any;
  deletedSnippetId?: string | null;
}

export const TextSnippets: React.FC<TextSnippetsProps> = ({
  roomCode,
  socketToken,
  roomKey,
  newSnippet,
  deletedSnippetId,
}) => {
  const [snippets, setSnippets] = useState<TextSnippet[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [selectedLang, setSelectedLang] = useState('auto');
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [formatNotice, setFormatNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [markdownViewMap, setMarkdownViewMap] = useState<Record<string, boolean>>({});

  const fetchRoomSnippets = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await getSnippets(roomCode, socketToken);
      setSnippets(res.snippets || []);
    } catch {
      // Ignore snippet fetch failure
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomSnippets();

    const interval = setInterval(() => {
      fetchRoomSnippets(true);
    }, 30000);

    const handleFocus = () => {
      fetchRoomSnippets(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [roomCode, socketToken]);

  // Sync real-time socket events
  useEffect(() => {
    if (newSnippet) {
      setSnippets((prev) => {
        if (!prev.find((s) => s.id === newSnippet.id)) {
          return [...prev, newSnippet];
        }
        return prev;
      });
    }
  }, [newSnippet]);

  useEffect(() => {
    if (deletedSnippetId) {
      setSnippets((prev) => prev.filter((s) => s.id !== deletedSnippetId));
    }
  }, [deletedSnippetId]);

  // Decrypt snippets if E2EE roomKey is provided
  useEffect(() => {
    let active = true;
    const processDecryption = async () => {
      if (!roomKey) return;
      const map: Record<string, string> = {};
      for (const s of snippets) {
        try {
          map[s.id] = await decryptText(s.content, roomKey);
        } catch {
          map[s.id] = s.content;
        }
      }
      if (active) {
        setDecryptedMap(map);
      }
    };
    processDecryption();
    return () => {
      active = false;
    };
  }, [snippets, roomKey]);

  const activeDetectedLang = selectedLang === 'auto' ? detectLanguage(inputContent) : selectedLang;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;

    try {
      setSubmitting(true);
      let contentToSend = inputContent.trim();

      if (roomKey) {
        contentToSend = await encryptText(contentToSend, roomKey);
      }

      const res = await createSnippet(roomCode, socketToken, contentToSend);
      setSnippets((prev) => [...prev, res.snippet]);
      setInputContent('');
      setPreviewMode('edit');
    } catch (err: any) {
      alert(err.message || 'Failed to share snippet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(inputContent);
      setInputContent(JSON.stringify(parsed, null, 2));
      setSelectedLang('json');
      setFormatNotice('JSON Formatted!');
      setTimeout(() => setFormatNotice(null), 2000);
    } catch {
      setFormatNotice('Invalid JSON');
      setTimeout(() => setFormatNotice(null), 2500);
    }
  };

  const handleDelete = async (snippetId: string) => {
    try {
      await deleteSnippet(roomCode, snippetId, socketToken);
      setSnippets((prev) => prev.filter((s) => s.id !== snippetId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete snippet');
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDownloadSnippet = (text: string, lang: string, id: string) => {
    const ext = getFileExtensionForLang(lang);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropx-${id.substring(0, 6)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleMarkdownView = (id: string) => {
    setMarkdownViewMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="mt-6 bg-slate-900/60 rounded-3xl border border-slate-800 p-4 sm:p-5 shadow-sm text-left">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Clipboard & Code Playground
            </h3>
            <p className="text-[11px] text-slate-400">
              Share code, markdown, JSON & notes in real-time.
            </p>
          </div>
        </div>

        {roomKey && (
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
            <Lock className="w-3 h-3" />
            <span>E2E Encrypted</span>
          </div>
        )}
      </div>

      {/* Editor & Controls */}
      <form onSubmit={handleSend} className="space-y-2 mb-4">
        {/* Editor Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <div className="relative">
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="appearance-none py-1 pl-2.5 pr-7 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-yellow-400 font-semibold focus:outline-none focus:border-yellow-400/50 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200">
                    {lang.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>

            {/* JSON Format Button */}
            {(activeDetectedLang === 'json' || selectedLang === 'json') && (
              <button
                type="button"
                onClick={handleFormatJson}
                className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/30 text-[11px] font-semibold flex items-center space-x-1 transition-all"
                title="Format and prettify JSON payload"
              >
                <Wand2 className="w-3 h-3" />
                <span>Format JSON</span>
              </button>
            )}

            {/* Markdown Preview Toggle */}
            {(activeDetectedLang === 'markdown' || selectedLang === 'markdown') && (
              <button
                type="button"
                onClick={() => setPreviewMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
                className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center space-x-1 transition-all"
              >
                {previewMode === 'edit' ? <Eye className="w-3 h-3 text-yellow-400" /> : <Edit3 className="w-3 h-3 text-yellow-400" />}
                <span>{previewMode === 'edit' ? 'Preview MD' : 'Edit Code'}</span>
              </button>
            )}

            {formatNotice && (
              <span className="text-[11px] font-bold text-yellow-400 animate-fade-in">
                {formatNotice}
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            {inputContent.length > 0 && `${inputContent.length} chars`}
          </div>
        </div>

        {/* Textarea Viewport or Live Markdown Viewport */}
        {previewMode === 'preview' ? (
          <div className="p-3.5 rounded-2xl bg-black border border-slate-800 min-h-[96px] max-h-60 overflow-y-auto">
            <MarkdownRenderer content={inputContent || '*Type markdown in edit mode to see preview*'} />
          </div>
        ) : (
          <textarea
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder="Type note, paste clipboard text, JSON, or code snippet..."
            rows={3}
            className="w-full p-3.5 rounded-2xl bg-black border border-slate-800 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-yellow-400/50 resize-y leading-relaxed"
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-500 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span>Detected: <strong className="text-yellow-400 uppercase font-mono">{activeDetectedLang}</strong></span>
          </span>

          <button
            type="submit"
            disabled={submitting || !inputContent.trim()}
            className="py-2 px-5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs flex items-center space-x-1.5 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Sharing...' : 'Share Snippet'}</span>
          </button>
        </div>
      </form>

      {/* Snippets List View */}
      {loading ? (
        <div className="text-center py-4 text-xs text-slate-400">Loading snippets...</div>
      ) : snippets.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-500 italic">
          No snippets or code shared yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {snippets.map((s) => {
            const rawContent = decryptedMap[s.id] || s.content;
            const lang = detectLanguage(rawContent);
            const isCopied = copiedId === s.id;
            const isMdView = markdownViewMap[s.id] ?? (lang === 'markdown');

            return (
              <div
                key={s.id}
                className="p-3.5 rounded-2xl bg-black/50 border border-slate-800/90 shadow-xs text-left"
              >
                {/* Snippet Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-yellow-400/10 border border-yellow-500/20 text-yellow-400 font-mono text-[10px] font-bold uppercase">
                      {lang}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {lang === 'markdown' && (
                      <button
                        onClick={() => toggleMarkdownView(s.id)}
                        className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center space-x-1 transition-colors"
                        title={isMdView ? 'View raw markdown' : 'Render markdown'}
                      >
                        {isMdView ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3 text-yellow-400" />}
                        <span>{isMdView ? 'Raw' : 'Render'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadSnippet(rawContent, lang, s.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Download as file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleCopy(s.id, rawContent)}
                      className={`py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                        isCopied
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                      title="Copy content"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[10px] font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="Delete snippet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                {lang === 'markdown' && isMdView ? (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs overflow-x-auto">
                    <MarkdownRenderer content={rawContent} />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 overflow-x-auto text-xs font-mono leading-relaxed max-h-48">
                    <pre className="m-0">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: highlightCode(rawContent, lang),
                        }}
                      />
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
