import { ScoreBreakdown } from '../hooks/useSocket';

interface Player {
  id: string;
  nickname: string;
  totalScore?: number;
  scoreBreakdown?: ScoreBreakdown;
}

interface ScoreBarChartProps {
  players: Player[];
  currentPlayerId?: string;
  theoreticalMax: number;
  phase: string;
}

const SEGMENTS = [
  { key: 'baseline' as const, label: 'Baseline', color: 'bg-gray-500' },
  { key: 'plausibility' as const, label: 'Plausibility', color: 'bg-blue-500' },
  { key: 'connection' as const, label: 'Connection', color: 'bg-emerald-500' },
  { key: 'planetBonus' as const, label: 'Planet', color: 'bg-violet-500' },
];

export function ScoreBarChart({
  players,
  currentPlayerId,
  theoreticalMax,
  phase,
}: ScoreBarChartProps) {
  if (phase !== 'PLAYING' && phase !== 'BREAK') {
    return null;
  }

  const safeMax = Math.max(theoreticalMax, 1);

  // Sort players by total score descending
  const sorted = [...players]
    .filter((p) => p.id)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  return (
    <div className="fixed bottom-4 left-4 z-10 w-80 bg-gray-900/85 backdrop-blur-sm rounded-lg p-3 shadow-xl">
      {/* Header */}
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Leaderboard
      </div>

      {/* Max reference bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] font-medium text-gray-500 uppercase">Max</span>
          <span className="text-[10px] font-mono text-gray-500">{safeMax}</span>
        </div>
        <div className="h-3 w-full rounded-sm bg-gray-700/60 overflow-hidden">
          <div className="h-full w-full bg-gray-600/40 rounded-sm" />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700/50 mb-2" />

      {/* Player bars */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {sorted.map((player) => {
          const total = player.totalScore ?? 0;
          const bd = player.scoreBreakdown ?? { baseline: 0, plausibility: 0, connection: 0, planetBonus: 0 };
          const barPercent = Math.min(100, (total / safeMax) * 100);
          const isCurrentPlayer = player.id === currentPlayerId;

          return (
            <div
              key={player.id}
              className={`rounded px-1 py-0.5 ${isCurrentPlayer ? 'bg-gray-700/40' : ''}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-[11px] font-medium truncate max-w-[160px] ${
                    isCurrentPlayer ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  {player.nickname}
                  {isCurrentPlayer && (
                    <span className="text-gray-500 ml-1 text-[9px]">(You)</span>
                  )}
                </span>
                <span className="text-[11px] font-mono text-gray-400 ml-2 shrink-0">
                  {total}
                </span>
              </div>

              {/* Stacked bar */}
              <div className="h-3 w-full rounded-sm bg-gray-800 overflow-hidden">
                <div
                  className="h-full flex transition-all duration-500 ease-out"
                  style={{ width: `${barPercent}%` }}
                >
                  {SEGMENTS.map((seg) => {
                    const segValue = bd[seg.key];
                    if (segValue <= 0 || total <= 0) return null;
                    const segPercent = (segValue / total) * 100;
                    return (
                      <div
                        key={seg.key}
                        className={`h-full ${seg.color} transition-all duration-500 ease-out`}
                        style={{ width: `${segPercent}%` }}
                        title={`${seg.label}: ${segValue}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-gray-700/50 mt-2 pt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${seg.color}`} />
            <span className="text-[9px] text-gray-500">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
