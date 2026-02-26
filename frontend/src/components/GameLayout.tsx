import React from 'react';
import { GameStatus } from './GameStatus';
import { PersonalScore } from './PersonalScore';
import { ScoreBarChart } from './ScoreBarChart';
import { HeadlineFeed } from './HeadlineFeed';
import { HeadlineInput } from './HeadlineInput';
import { PriorityPlanet } from './PriorityPlanet';
import { InGameDate } from './InGameDate';
import { RoundSummary } from './RoundSummary';
import { PlayerList } from './PlayerList';
import { Badge } from './ui';
import { Headline, RoundSummary as RoundSummaryType } from '../hooks/useSocket';
import { useInGameNow } from '../hooks/useInGameNow';

interface GameLayoutProps {
  joinCode: string;
  players: any[];
  currentPlayerId: string;
  phase: string;
  currentRound: number;
  maxRounds: number;
  phaseEndsAt: string | null;
  serverNow: string;
  inGameNow: string | null;
  timelineSpeedRatio: number;
  headlines: Headline[];
  roundSummary: RoundSummaryType | null;
  priorityPlanet: string | null;
  myScore: number;
  totalGameMins: number;
  currentGameMins: number;
  onSubmitHeadline: (headline: string) => Promise<{ success: boolean; error?: string; cooldownMs?: number }>;
  onBack: () => void;
  /* Lobby-specific slots */
  lobbyContent?: React.ReactNode;
}

export function GameLayout({
  joinCode,
  players,
  currentPlayerId,
  phase,
  currentRound,
  maxRounds,
  phaseEndsAt,
  serverNow,
  inGameNow,
  timelineSpeedRatio,
  headlines,
  roundSummary,
  priorityPlanet,
  myScore,
  totalGameMins,
  currentGameMins,
  onSubmitHeadline,
  onBack,
  lobbyContent,
}: GameLayoutProps) {
  const isWaiting = phase === 'WAITING';
  const isFinished = phase === 'FINISHED';
  const inGame = !isWaiting && !isFinished;

  const derivedInGameNow = useInGameNow({
    inGameNow,
    serverNow,
    timelineSpeedRatio,
    enabled: inGame,
  });

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-gray-50 to-gray-100/80">
      {/* ─── Top HUD bar ─── */}
      <header className="shrink-0 z-20 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          {/* Left: session code + leave */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Leave"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <Badge variant="default">{joinCode}</Badge>
          </div>

          {/* Center: game status */}
          {inGame && (
            <div className="flex-1 flex justify-center">
              <GameStatus
                phase={phase}
                currentRound={currentRound}
                maxRounds={maxRounds}
                phaseEndsAt={phaseEndsAt}
                serverNow={serverNow}
                inGameNow={inGameNow}
              />
            </div>
          )}

          {/* Right: personal score */}
          {inGame && <PersonalScore score={myScore} />}
        </div>
      </header>

      {/* ─── WAITING / FINISHED: render lobby content ─── */}
      {(isWaiting || isFinished) && (
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {lobbyContent}
            <PlayerList players={players} currentPlayerId={currentPlayerId} />
            <div className="flex justify-center">
              <button
                onClick={onBack}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Leave lobby
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ─── IN-GAME: 3-column grid ─── */}
      {inGame && (
        <main className="flex-1 min-h-0 overflow-hidden">
          {/* Desktop layout */}
          <div className="hidden lg:grid lg:grid-cols-[240px_1fr_240px] gap-4 h-full max-w-7xl mx-auto px-4 py-4">
            {/* ── Left sidebar ── */}
            <aside className="min-h-0 overflow-y-auto pr-1">
              <ScoreBarChart
                players={players}
                currentPlayerId={currentPlayerId}
                totalGameMins={totalGameMins}
                currentGameMins={currentGameMins}
                phase={phase}
              />
            </aside>

            {/* ── Center: feed + input ── */}
            <section className="flex flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-hidden">
                <HeadlineFeed
                  headlines={headlines}
                  currentPlayerId={currentPlayerId}
                  currentRound={currentRound}
                />
              </div>
              {phase === 'PLAYING' && (
                <div className="shrink-0 pt-3 pb-[env(safe-area-inset-bottom)]">
                  <HeadlineInput
                    onSubmit={onSubmitHeadline}
                    phase={phase}
                  />
                </div>
              )}
            </section>

            {/* ── Right sidebar ── */}
            <aside className="min-h-0 overflow-y-auto space-y-4 pl-1">
              <PriorityPlanet planet={priorityPlanet} />
              <InGameDate inGameNow={derivedInGameNow} />
              {phase === 'BREAK' && roundSummary && (
                <RoundSummary summary={roundSummary} roundNo={currentRound} />
              )}
            </aside>
          </div>

          {/* ── Mobile layout ── */}
          <div className="lg:hidden flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <PriorityPlanet planet={priorityPlanet} />
                <InGameDate inGameNow={derivedInGameNow} />
              </div>
              <HeadlineFeed
                headlines={headlines}
                currentPlayerId={currentPlayerId}
                currentRound={currentRound}
              />
              <ScoreBarChart
                players={players}
                currentPlayerId={currentPlayerId}
                totalGameMins={totalGameMins}
                currentGameMins={currentGameMins}
                phase={phase}
              />
              {phase === 'BREAK' && roundSummary && (
                <RoundSummary summary={roundSummary} roundNo={currentRound} />
              )}
            </div>
            {phase === 'PLAYING' && (
              <div className="shrink-0 px-4 pb-[env(safe-area-inset-bottom)] pb-3 pt-2 border-t border-gray-100 bg-white/80 backdrop-blur">
                <HeadlineInput
                  onSubmit={onSubmitHeadline}
                  phase={phase}
                />
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
