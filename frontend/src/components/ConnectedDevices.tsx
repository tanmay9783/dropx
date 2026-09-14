import { Users, Crown, Smartphone, Laptop, Wifi } from 'lucide-react';

export interface ParticipantInfo {
  id: string;
  role: 'owner' | 'participant' | string;
  deviceName?: string;
}

interface ConnectedDevicesProps {
  participants?: ParticipantInfo[];
  participantCount: number;
  currentParticipantId?: string;
  isOwner?: boolean;
}

export const ConnectedDevices: React.FC<ConnectedDevicesProps> = ({
  participants = [],
  participantCount,
  currentParticipantId,
  isOwner = false,
}) => {
  // If participants array is empty, construct fallback entries from count
  const displayList: ParticipantInfo[] = participants.length > 0 
    ? participants 
    : [
        { id: isOwner ? 'Host Device' : 'host-1', role: 'owner', deviceName: 'Host Device' },
        ...(participantCount > 1 ? [{ id: currentParticipantId || 'guest-1', role: 'participant', deviceName: 'Guest Device' }] : [])
      ];

  const getDeviceIcon = (id: string, role: string) => {
    if (role === 'owner') return <Crown className="w-4 h-4 text-amber-400" />;
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 2 === 0 ? (
      <Smartphone className="w-4 h-4 text-cyan-400" />
    ) : (
      <Laptop className="w-4 h-4 text-violet-400" />
    );
  };

  const getDeviceLabel = (p: ParticipantInfo) => {
    if (p.role === 'owner') return p.deviceName || 'Host (Room Creator)';
    return p.deviceName || `Device #${p.id.substring(0, 4)}`;
  };

  return (
    <div className="w-full glass-panel-subtle rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 my-4 text-left">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 dark:text-cyan-400">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Connected Devices
          </span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-semibold border border-cyan-500/20">
          {participantCount} Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {displayList.map((p, idx) => {
          const isCurrent = currentParticipantId ? p.id === currentParticipantId : (isOwner && p.role === 'owner');
          return (
            <div
              key={p.id || idx}
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                isCurrent
                  ? 'bg-cyan-500/5 dark:bg-cyan-950/40 border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                  {getDeviceIcon(p.id, p.role)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {getDeviceLabel(p)}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 font-extrabold uppercase">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Real-time connected</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 text-slate-400">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
