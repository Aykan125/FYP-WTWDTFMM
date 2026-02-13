import { useState } from 'react';
import { PlayerList } from './PlayerList';
import { GameStatus } from './GameStatus';
import { PersonalScore } from './PersonalScore';
import { HeadlineInput } from './HeadlineInput';
import { HeadlineFeed } from './HeadlineFeed';
import { RoundSummary } from './RoundSummary';
import { ScoreBarChart } from './ScoreBarChart';
import { Headline, RoundSummary as RoundSummaryType } from '../hooks/useSocket';
import { useTheoreticalMax } from '../hooks/useTheoreticalMax';

interface HostLobbyProps {
  joinCode: string;
  players: any[];
  currentPlayerId: string;
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
  onStartGame: () => void;
  onBack: () => void;
  onSubmitHeadline: (headline: string) => Promise<{ success: boolean; error?: string; cooldownMs?: number }>;
}

export function HostLobby({
  joinCode,
  players,
  currentPlayerId,
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
  onStartGame,
  onBack,
  onSubmitHeadline,
}: HostLobbyProps) {
  const [copied, setCopied] = useState(false);

  const theoreticalMax = useTheoreticalMax({
    phase,
    currentRound,
    playMinutes,
    phaseStartedAt,
    serverNow,
  });

  const copyJoinCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWaiting = phase === 'WAITING';
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const priorityPlanet = currentPlayer?.priorityPlanet ?? null;
  const myScore = currentPlayer?.totalScore ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Game Lobby
          </h1>
          <p className="text-gray-600">
            Share the code below with other players
          </p>
        </div>

        {/* Join Code Card */}
        {isWaiting && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-sm text-gray-600 mb-2">Join Code</p>
            <div className="flex items-center justify-center space-x-4">
              <span className="text-5xl font-mono font-bold text-indigo-600 tracking-wider">
                {joinCode}
              </span>
              <button
                onClick={copyJoinCode}
                className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Game Status and Personal Score */}
        {!isWaiting && (
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
          {isWaiting && (
            <button
              onClick={onStartGame}
              disabled={players.length < 2}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
                players.length < 2
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              Start Game {players.length < 2 && '(Need 2+ players)'}
            </button>
          )}
        </div>

        {/* Instructions */}
        {isWaiting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Instructions:</strong> Wait for other players to join using
              the code above. You need at least 2 players to start the game.
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

