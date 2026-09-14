import React, { useState, useEffect } from 'react';
import { Copy, Check, Trash2, Send, MessageSquare, Lock } from 'lucide-react';
import { TextSnippet, getSnippets, createSnippet, deleteSnippet } from '../services/api';
import { encryptText, decryptText } from '../utils/crypto';

interface TextSnippetsProps {
  roomCode: string;
  socketToken: string;
  roomKey?: string | null;
  newSnippet?: any;
  deletedSnippetId?: string | null;
}

export const TextSnippets: React.FC<TextSnippetsProps> = ({ roomCode, socketToken, roomKey, newSnippet, deletedSnippetId }) => {
  const [snippets, setSnippets] = useState<TextSnippet[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});

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

    // 4-second fallback polling interval for guaranteed auto-sync across instances
    const interval = setInterval(() => {
      fetchRoomSnippets(true);
    }, 4000);

    const handleFocus = () => {
      fetchRoomSnippets(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [roomCode, socketToken]);

  // Sync incoming real-time socket events
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
          map[s.id] = s.content; // fallback if plain text
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;

    try {
      setSubmitting(true);
      let contentToSend = inputContent.trim();

      // Encrypt if roomKey is present
      if (roomKey) {
        contentToSend = await encryptText(contentToSend, roomKey);
      }

      const res = await createSnippet(roomCode, socketToken, contentToSend);
      setSnippets((prev) => [...prev, res.snippet]);
      setInputContent('');
    } catch (err: any) {
      alert(err.message || 'Failed to share snippet');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="mt-8 bg-slate-50 dark:bg-slate-900/60 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Live Room Clipboard / Text Snippets
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Paste copied links, text notes, or code to sync instantly across devices.
            </p>
          </div>
        </div>

        {roomKey && (
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
            <Lock className="w-3 h-3" />
            <span>E2EE Encrypted</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Type or paste text/link to share..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
        <button
          type="submit"
          disabled={submitting || !inputContent.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 disabled:opacity-50 transition-all shadow-md active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{submitting ? 'Sending...' : 'Send'}</span>
        </button>
      </form>

      {/* Snippet List */}
      {loading ? (
        <div className="text-center py-4 text-xs text-slate-400">Loading snippets...</div>
      ) : snippets.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-400 italic">No text snippets shared yet</div>
      ) : (
        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
          {snippets.map((s) => {
            const displayText = decryptedMap[s.id] || s.content;
            const isCopied = copiedId === s.id;

            return (
              <div
                key={s.id}
                className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-mono break-all line-clamp-2">
                    {displayText}
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(s.id, displayText)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                      isCopied
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                    }`}
                    title="Copy text"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-500" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
                    title="Delete snippet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
