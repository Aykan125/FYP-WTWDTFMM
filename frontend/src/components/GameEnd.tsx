import { useRef, useState } from 'react';
import { Headline, Player, FinalSummary } from '../hooks/useSocket';
import { Card, SectionTitle, Button } from './ui';
import { ScoreBarChart } from './ScoreBarChart';
import { HeadlineFeed } from './HeadlineFeed';

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
  const realPlayers = players.filter((p) => p.nickname !== 'Archive');
  const realHeadlines = headlines;

  const isGenerating = !finalSummary || finalSummary.status === 'generating';
  const hasSummary =
    finalSummary?.status === 'completed' && finalSummary.summary;
  const reports = hasSummary ? finalSummary.summary?.reports ?? [] : [];

  const pdfRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    try {
      const [html2canvas, jsPDF] = await Promise.all([
        import('html2canvas').then((m) => m.default),
        import('jspdf').then((m) => m.jsPDF),
      ]);

      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`future-headlines-${joinCode}-${date}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div ref={pdfRef} className="space-y-6">
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

          {/* Headlines list (replaces the old Game Statistics card) */}
          <div className="h-[400px]">
            <HeadlineFeed
              headlines={realHeadlines}
              currentPlayerId={currentPlayerId}
            />
          </div>

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
        </div>

        {/* Buttons (NOT inside pdfRef, so they don't appear in the PDF) */}
        <div className="flex justify-center gap-3 pb-8 pt-6">
          <Button
            variant="primary"
            onClick={handleDownloadPdf}
            disabled={generatingPdf || isGenerating}
          >
            {generatingPdf ? 'Generating PDF...' : 'Download PDF'}
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Leave game
          </Button>
        </div>
      </div>
    </main>
  );
}
