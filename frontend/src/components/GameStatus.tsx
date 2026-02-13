import { usePhaseTimer } from '../hooks/usePhaseTimer';
import { PriorityPlanet } from './PriorityPlanet';

interface GameStatusProps {
  phase: string;
  currentRound: number;
  maxRounds: number;
  phaseEndsAt: string | null;
  serverNow: string;
  inGameNow: string | null;
  priorityPlanet?: string | null;
}

export function GameStatus({
  phase,
  currentRound,
  maxRounds,
  phaseEndsAt,
  serverNow,
  inGameNow,
  priorityPlanet,
}: GameStatusProps) {
  const { remainingFormatted } = usePhaseTimer({ phaseEndsAt, serverNow });

  const getPhaseLabel = () => {
    switch (phase) {
      case 'WAITING':
        return { text: 'Waiting to Start', color: 'bg-gray-100 text-gray-800' };
      case 'PLAYING':
        return { text: 'Playing', color: 'bg-green-100 text-green-800' };
      case 'BREAK':
        return { text: 'Break Time', color: 'bg-blue-100 text-blue-800' };
      case 'FINISHED':
        return { text: 'Game Finished', color: 'bg-purple-100 text-purple-800' };
      default:
        return { text: phase, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const phaseLabel = getPhaseLabel();

  const formatInGameTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      {/* Phase Badge */}
      <div className="flex items-center justify-between">
        <div>
          <span
            className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${phaseLabel.color}`}
          >
            {phaseLabel.text}
          </span>
        </div>
        {phase !== 'WAITING' && phase !== 'FINISHED' && (
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-gray-900">
              {remainingFormatted}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Time Remaining
            </div>
          </div>
        )}
      </div>

      {/* Round Info */}
      {(phase === 'PLAYING' || phase === 'BREAK') && currentRound > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Round</span>
          <span className="text-lg font-bold text-gray-900">
            {currentRound} of {maxRounds}
          </span>
          <div className="flex-1 bg-gray-200 rounded-full h-2 ml-4">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentRound / maxRounds) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Priority Planet */}
      {(phase === 'PLAYING' || phase === 'BREAK') && (
        <div className="border-t pt-4">
          <PriorityPlanet planet={priorityPlanet ?? null} />
        </div>
      )}

      {/* In-Game Time */}
      {inGameNow && (
        <div className="border-t pt-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📅</span>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                In-Game Date
              </div>
              <div className="text-sm font-medium text-gray-900">
                {formatInGameTime(inGameNow)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

