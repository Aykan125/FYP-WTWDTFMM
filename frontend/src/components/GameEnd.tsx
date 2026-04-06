import { Headline, Player, RoundSummary as RoundSummaryType } from '../hooks/useSocket';
import { Card, SectionTitle, Badge, Button } from './ui';
import { ScoreBarChart } from './ScoreBarChart';

interface GameEndProps {
  joinCode: string;
  players: Player[];
  headlines: Headline[];
  currentPlayerId: string;
  maxRounds: number;
  totalGameMins: number;
  currentGameMins: number;
  roundSummary: RoundSummaryType | null;
  onBack: () => void;
}

export function GameEnd({
  joinCode,
  players,
  headlines,
  currentPlayerId,
  maxRounds,
  totalGameMins,
  currentGameMins,
  roundSummary,
  onBack,
}: GameEndProps) {
  // Filter out Archive system player
  const realPlayers = players.filter((p) => p.nickname !== 'Archive');
  const realHeadlines = headlines.filter((h) => h.playerNickname !== 'Archive');

  // Compute statistics
  const totalHeadlines = realHeadlines.length;
  const topScorer = [...realPlayers].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)
  )[0];

  // Most prolific player
  const headlineCountByPlayer: Record<string, number> = {};
  for (const h of realHeadlines) {
    headlineCountByPlayer[h.playerNickname] =
      (headlineCountByPlayer[h.playerNickname] ?? 0) + 1;
  }
  const mostProlific = Object.entries(headlineCountByPlayer).sort(
    (a, b) => b[1] - a[1]
  )[0];

  // Average plausibility (from totalScore via plausibilityScore if available)
  const headlinesWithScores = realHeadlines.filter(
    (h) => h.plausibilityScore != null
  );
  const avgPlaus =
    headlinesWithScores.length > 0
      ? headlinesWithScores.reduce(
          (sum, h) => sum + (h.plausibilityScore ?? 0),
          0
        ) / headlinesWithScores.length
      : 0;

  // Most common planet
  const planetCount: Record<string, number> = {};
  for (const h of realHeadlines) {
    if (h.planets) {
      for (const p of h.planets) {
        planetCount[p] = (planetCount[p] ?? 0) + 1;
      }
    }
  }
  const topPlanet = Object.entries(planetCount).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const isGenerating = !roundSummary || roundSummary.status === 'generating';
  const hasSummary =
    roundSummary?.status === 'completed' && roundSummary.summary;

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Game Complete</h1>
          <p className="text-sm text-gray-400 mt-1">
            Session {joinCode} &middot; {maxRounds} rounds &middot; 20 years of history
          </p>
        </div>

        {/* Leaderboard */}
        <Card padding="md">
          <SectionTitle>Final Leaderboard</SectionTitle>
          <ScoreBarChart
            players={realPlayers}
            currentPlayerId={currentPlayerId}
            totalGameMins={totalGameMins}
            currentGameMins={currentGameMins}
            phase="BREAK"
          />
        </Card>

        {/* Statistics */}
        <Card padding="md">
          <SectionTitle>Game Statistics</SectionTitle>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Total headlines</span>
              <span className="text-lg font-semibold text-gray-700">{totalHeadlines}</span>
            </div>
            {topScorer && (
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Top scorer</span>
                <span className="text-lg font-semibold text-indigo-600">
                  {topScorer.nickname} &middot; {topScorer.totalScore ?? 0} pts
                </span>
              </div>
            )}
            {mostProlific && (
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Most prolific</span>
                <span className="text-lg font-semibold text-gray-700">
                  {mostProlific[0]} &middot; {mostProlific[1]} headlines
                </span>
              </div>
            )}
            {headlinesWithScores.length > 0 && (
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg plausibility score</span>
                <span className="text-lg font-semibold text-gray-700">
                  {avgPlaus.toFixed(2)} / 2
                </span>
              </div>
            )}
            {topPlanet && (
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Most common planet</span>
                <span className="text-lg font-semibold text-violet-600">
                  {topPlanet[0]} &middot; {topPlanet[1]} mentions
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Players</span>
              <span className="text-lg font-semibold text-gray-700">{realPlayers.length}</span>
            </div>
          </div>
        </Card>

        {/* Final Narrative Summary */}
        <Card padding="md">
          <SectionTitle>The {maxRounds * 5}-Year Recap</SectionTitle>

          {isGenerating && (
            <div className="py-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-indigo-500" />
                <span>Writing the final recap of the game...</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-4/6" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {roundSummary?.status === 'error' && (
            <div className="py-4">
              <p className="text-sm text-red-500">Final summary unavailable</p>
              {roundSummary.error && (
                <p className="text-xs text-red-400 mt-1">{roundSummary.error}</p>
              )}
            </div>
          )}

          {hasSummary && roundSummary.summary && (
            <div className="space-y-4">
              <div className="flex gap-2 text-xs text-gray-400">
                <span>{roundSummary.summary.roundStats.headlineCount} developments</span>
                <span>&middot;</span>
                <span>{roundSummary.summary.roundStats.playerCount} sources</span>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {roundSummary.summary.narrative}
              </p>

              {roundSummary.summary.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {roundSummary.summary.themes.map((theme, i) => (
                    <Badge key={i} variant="blue">{theme}</Badge>
                  ))}
                </div>
              )}

              {roundSummary.summary.highlightedHeadlines.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Key Developments
                  </span>
                  {roundSummary.summary.highlightedHeadlines.map((h, i) => (
                    <div key={i} className="pl-3 border-l-2 border-indigo-200">
                      <p className="text-sm font-medium text-gray-700">&ldquo;{h.headline}&rdquo;</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.source} &middot; {h.significance}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Leave button */}
        <div className="flex justify-center pb-8">
          <Button variant="secondary" onClick={onBack}>
            Leave game
          </Button>
        </div>
      </div>
    </main>
  );
}
