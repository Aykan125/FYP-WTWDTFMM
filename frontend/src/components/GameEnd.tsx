import { Headline, Player, FinalSummary } from '../hooks/useSocket';
import { Card, SectionTitle, Button } from './ui';
import { ScoreBarChart } from './ScoreBarChart';

interface GameEndProps {
  joinCode: string;
  players: Player[];
  headlines: Headline[];
  currentPlayerId: string;
  maxRounds: number;
  totalGameMins: number;
  currentGameMins: number;
  finalSummary: FinalSummary | null;
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
  finalSummary,
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

  const isGenerating = !finalSummary || finalSummary.status === 'generating';
  const hasSummary =
    finalSummary?.status === 'completed' && finalSummary.summary;
  const reports = hasSummary ? finalSummary.summary?.reports ?? [] : [];

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

        {/* Final Narrative — Experience Reports */}
        <Card padding="md">
          <SectionTitle>Experience Reports From These Years</SectionTitle>

          {isGenerating && (
            <div className="py-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-indigo-500" />
                <span>Writing the experience reports...</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-4/6" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
              </div>
              <p className="text-xs text-gray-400 mt-4">
                The AI is writing first-person accounts from different characters living through your timeline. This may take 30-60 seconds.
              </p>
            </div>
          )}

          {finalSummary?.status === 'error' && (
            <div className="py-4">
              <p className="text-sm text-red-500">Experience reports unavailable</p>
              {finalSummary.error && (
                <p className="text-xs text-red-400 mt-1">{finalSummary.error}</p>
              )}
            </div>
          )}

          {hasSummary && reports.length > 0 && (
            <div className="space-y-8">
              <p className="text-xs text-gray-400">
                Three fictional characters who lived through your timeline.
              </p>
              {reports.map((report, i) => (
                <div key={i} className="space-y-3">
                  <div className="border-l-2 border-indigo-300 pl-3">
                    <div className="text-sm font-semibold text-gray-700">{report.character.name}</div>
                    <div className="text-xs text-gray-500">{report.character.role}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{report.character.era}</div>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {report.story}
                  </p>

                  {report.themes_touched.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {report.themes_touched.map((theme, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}

                  {i < reports.length - 1 && <div className="border-t border-gray-100 pt-2" />}
                </div>
              ))}
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
