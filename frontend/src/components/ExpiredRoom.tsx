import { Clock, Plus, ShieldCheck } from 'lucide-react';

interface ExpiredRoomProps {
  onCreateNew: () => void;
}

export const ExpiredRoom: React.FC<ExpiredRoomProps> = ({ onCreateNew }) => {
  return (
    <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 text-center shadow-2xl transition-colors duration-300">
      <div className="h-16 w-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/10">
        <Clock className="w-8 h-8" />
      </div>

      <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">
        Session Expired
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        This temporary sharing session has expired. To maintain privacy, all shared files and room metadata have been permanently purged from cloud storage.
      </p>

      <div className="mb-8 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-left">
        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-Trace Privacy Policy</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          No logs or leftover file bytes remain on the server or storage directory.
        </p>
      </div>

      <button
        onClick={onCreateNew}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
      >
        <Plus className="w-4 h-4" />
        <span>Create New Room</span>
      </button>
    </div>
  );
};
