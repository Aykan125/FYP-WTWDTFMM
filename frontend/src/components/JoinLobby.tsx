import { PlayerList } from './PlayerList';
import { GameStatus } from './GameStatus';
import { PersonalScore } from './PersonalScore';
import { HeadlineInput } from './HeadlineInput';
import { HeadlineFeed } from './HeadlineFeed';
import { RoundSummary } from './RoundSummary';
import { ScoreBarChart } from './ScoreBarChart';
import { Headline, RoundSummary as RoundSummaryType } from '../hooks/useSocket';
import { useTheoreticalMax } from '../hooks/useTheoreticalMax';

interface JoinLobbyProps {
  joinCode: string;
  players: any[];
  currentPlayerId: string;
  isHost: boolean;
  phase: string;
  currentRound: number;
  maxRounds: number;
  playMinutes: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  serverNow: string;
  inGameNow: string | null;
  headlines: Headline[];
  roundSummary: RoundSummaryType | null;
  onBack: () => void;
  onSubmitHeadline: (headline: string) => Promise<{ success: boolean; error?: string; cooldownMs?: number }>;
}

export function JoinLobby({
  joinCode,
  players,
  currentPlayerId,
  isHost,
  phase,
  currentRound,
  maxRounds,
  playMinutes,
  phaseStartedAt,
  phaseEndsAt,
  serverNow,
  inGameNow,
  headlines,
  roundSummary,
  onBack,
  onSubmitHeadline,
}: JoinLobbyProps) {
  const isWaiting = phase === 'WAITING';
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const priorityPlanet = currentPlayer?.priorityPlanet ?? null;
  const myScore = currentPlayer?.totalScore ?? 0;

  const theoreticalMax = useTheoreticalMax({
    phase,
    currentRound,
    playMinutes,
    phaseStartedAt,
    serverNow,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Waiting for Game to Start
          </h1>
          <p className="text-gray-600">
            Session: <span className="font-mono font-bold">{joinCode}</span>
          </p>
        </div>

        {/* Status Card / Game Status and Personal Score */}
        {isWaiting ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-lg text-gray-700">Connected to lobby</p>
            </div>
            <p className="text-sm text-gray-500">
              {isHost
                ? 'You are the host. Start the game when ready!'
                : 'Waiting for the host to start the game...'}
            </p>
          </div>
        ) : (
          <div className="flex gap-4">
            <div className="flex-1">
              <GameStatus
                phase={phase}
                currentRound={currentRound}
                maxRounds={maxRounds}
                phaseEndsAt={phaseEndsAt}
                serverNow={serverNow}
                inGameNow={inGameNow}
                priorityPlanet={priorityPlanet}
              />
            </div>
            <PersonalScore score={myScore} />
          </div>
        )}

        {/* Round Summary - Show during BREAK phase */}
        {phase === 'BREAK' && roundSummary && (
          <RoundSummary summary={roundSummary} roundNo={currentRound} />
        )}

        {/* Headline Input & Feed - Show during game */}
        {!isWaiting && phase !== 'FINISHED' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HeadlineInput
              onSubmit={onSubmitHeadline}
              phase={phase}
            />
            <HeadlineFeed
              headlines={headlines}
              currentPlayerId={currentPlayerId}
              currentRound={currentRound}
            />
          </div>
        )}

        {/* Player List */}
        <PlayerList players={players} currentPlayerId={currentPlayerId} />

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
          >
            Leave Lobby
          </button>
        </div>

        {/* Instructions */}
        {isWaiting && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>Tip:</strong> More players can join using the code{' '}
              <span className="font-mono font-bold">{joinCode}</span>. Share it
              with your friends!
            </p>
          </div>
        )}
      </div>

      {/* Score Bar Chart - fixed bottom-left */}
      <ScoreBarChart
        players={players}
        currentPlayerId={currentPlayerId}
        theoreticalMax={theoreticalMax}
        phase={phase}
      />
    </div>
  );
}

