import { RoundSummary as RoundSummaryType } from '../hooks/useSocket';

interface RoundSummaryProps {
  summary: RoundSummaryType;
  roundNo: number;
}

export function RoundSummary({ summary, roundNo }: RoundSummaryProps) {
  // Generating state - show loading spinner
  if (summary.status === 'generating') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span className="text-gray-600">Generating round summary...</span>
        </div>
        <div className="mt-4 space-y-3">
          {/* Skeleton placeholder */}
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
        </div>
      </div>
    );
  }

  // Error state - show error message
  if (summary.status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-700 font-medium">Summary unavailable</span>
        </div>
        {summary.error && (
          <p className="mt-2 text-sm text-red-600">{summary.error}</p>
        )}
      </div>
    );
  }

  // Pending state - no summary yet
  if (summary.status === 'pending' || !summary.summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
        No summary available yet
      </div>
    );
  }

  // Completed state - show full summary
  const { narrative, themes, highlightedHeadlines, dominantPlanets, roundStats } = summary.summary;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            Timeline Update - Period {roundNo}
          </h3>
          <div className="flex items-center space-x-3 text-sm text-indigo-100">
            <span>{roundStats.headlineCount} developments</span>
            <span className="text-indigo-300">|</span>
            <span>{roundStats.playerCount} sources</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Narrative */}
        <div>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {narrative}
          </p>
        </div>

        {/* Themes */}
        {themes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Key Themes
            </h4>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Highlighted Headlines */}
        {highlightedHeadlines.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Key Developments
            </h4>
            <div className="space-y-3">
              {highlightedHeadlines.map((highlight, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 border-l-4 border-indigo-500"
                >
                  <p className="font-medium text-gray-900 mb-1">
                    "{highlight.headline}"
                  </p>
                  <p className="text-sm text-gray-500 mb-1">
                    Reported by {highlight.source}
                  </p>
                  <p className="text-sm text-gray-600">
                    {highlight.significance}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dominant Planets */}
        {dominantPlanets.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Planetary Influences
            </h4>
            <div className="flex flex-wrap gap-2">
              {dominantPlanets.map((planet, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                >
                  {planet}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
