import { useEffect, useRef } from 'react';
import { Headline } from '../hooks/useSocket';
import { Card, SectionTitle } from './ui';

interface HeadlineFeedProps {
  headlines: Headline[];
  currentPlayerId: string;
  currentRound?: number;
}

export function HeadlineFeed({ headlines, currentPlayerId, currentRound }: HeadlineFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (feedRef.current && !userScrolledRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [headlines.length]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 50;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayedHeadlines = currentRound !== undefined
    ? headlines.filter((h) => h.roundNo === currentRound)
    : headlines;

  if (displayedHeadlines.length === 0) {
    return (
      <Card className="flex flex-col h-full min-h-0">
        <SectionTitle>Timeline</SectionTitle>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-12">
          <svg className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <p className="text-sm text-gray-400">No headlines yet</p>
          <p className="text-xs text-gray-300 mt-1">Be the first to submit one!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full min-h-0">
      <SectionTitle count={displayedHeadlines.length}>Timeline</SectionTitle>

      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0"
      >
        {displayedHeadlines.map((headline) => {
          const isOwn = headline.playerId === currentPlayerId;

          return (
            <div
              key={headline.id}
              className={`px-3 py-2.5 rounded-lg border ${
                isOwn
                  ? 'bg-indigo-50/60 border-indigo-100'
                  : 'bg-gray-50/60 border-gray-100'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-medium ${isOwn ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {headline.playerNickname}
                  {isOwn && <span className="ml-1 text-gray-400">(you)</span>}
                </span>
                <span className="text-[11px] text-gray-300">
                  R{headline.roundNo} &middot; {formatTime(headline.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed">
                &ldquo;{headline.text}&rdquo;
              </p>
            </div>
          );
        })}
      </div>

      {userScrolledRef.current && (
        <button
          onClick={() => {
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight;
              userScrolledRef.current = false;
            }
          }}
          className="mt-2 text-center text-xs text-indigo-500 hover:text-indigo-700 py-1 transition-colors"
        >
          Scroll to latest
        </button>
      )}
    </Card>
  );
}
