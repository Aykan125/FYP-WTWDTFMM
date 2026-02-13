import { useEffect, useRef } from 'react';
import { Headline } from '../hooks/useSocket';

interface HeadlineFeedProps {
  headlines: Headline[];
  currentPlayerId: string;
  currentRound?: number;
}

export function HeadlineFeed({ headlines, currentPlayerId, currentRound }: HeadlineFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll to bottom when new headlines arrive (unless user scrolled up)
  useEffect(() => {
    if (feedRef.current && !userScrolledRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [headlines.length]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    // Consider "at bottom" if within 50px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    userScrolledRef.current = !isAtBottom;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter by current round if specified
  const displayedHeadlines = currentRound !== undefined
    ? headlines.filter((h) => h.roundNo === currentRound)
    : headlines;

  if (displayedHeadlines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Headlines Feed</h3>
        <div className="text-center py-8 text-gray-400">
          <svg
            className="mx-auto h-12 w-12 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <p className="text-sm">No headlines yet</p>
          <p className="text-xs mt-1">Be the first to submit one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Headlines Feed</h3>
        <span className="text-xs text-gray-400">
          {displayedHeadlines.length} headline{displayedHeadlines.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="space-y-3 max-h-80 overflow-y-auto pr-2"
      >
        {displayedHeadlines.map((headline) => {
          const isOwn = headline.playerId === currentPlayerId;
          
          return (
            <div
              key={headline.id}
              className={`p-3 rounded-lg border ${
                isOwn
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-medium ${isOwn ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {headline.playerNickname}
                  {isOwn && <span className="ml-1 text-xs">(you)</span>}
                </span>
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                  <span>Round {headline.roundNo}</span>
                  <span>•</span>
                  <span>{formatTime(headline.createdAt)}</span>
                </div>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed">
                "{headline.text}"
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
          className="mt-2 w-full text-center text-xs text-indigo-600 hover:text-indigo-800 py-1"
        >
          ↓ Scroll to latest
        </button>
      )}
    </div>
  );
}


