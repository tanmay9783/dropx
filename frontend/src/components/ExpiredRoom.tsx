import React from 'react';
import { Clock, Plus, ShieldX } from 'lucide-react';

interface ExpiredRoomProps {
  onCreateNew: () => void;
}

export const ExpiredRoom: React.FC<ExpiredRoomProps> = ({ onCreateNew }) => {
  return (
    <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-rose-900/50 shadow-2xl text-center">
      <div className="h-16 w-16 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-950/50">
        <ShieldX className="w-8 h-8" />
      </div>

      <h2 className="text-2xl font-bold text-slate-100 mb-2">Room Expired</h2>
      <p className="text-xs text-rose-300/80 font-medium mb-6">
        This sharing session has ended.
      </p>

      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 leading-relaxed mb-8">
        <div className="flex items-center justify-center space-x-1.5 text-slate-300 font-semibold mb-2">
          <Clock className="w-4 h-4 text-rose-400" />
          <span>Automatic Session Cleanup</span>
        </div>
        All temporary files associated with this room will be deleted automatically.
      </div>

      <button
        onClick={onCreateNew}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all"
      >
        <Plus className="w-4 h-4" />
        <span>Create New Room</span>
      </button>
    </div>
  );
};
