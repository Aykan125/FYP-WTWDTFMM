import { useState, useEffect, useRef } from 'react';

interface HeadlineInputProps {
  onSubmit: (headline: string) => Promise<{ success: boolean; error?: string; cooldownMs?: number }>;
  disabled?: boolean;
  phase: string;
}

export function HeadlineInput({ onSubmit, disabled = false, phase }: HeadlineInputProps) {
  const [headline, setHeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownMs <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const startTime = Date.now();
    const startCooldown = cooldownMs;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, startCooldown - elapsed);
      setCooldownMs(remaining);

      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [cooldownMs > 0]); // Only re-run when transitioning to/from cooldown

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!headline.trim() || isSubmitting || cooldownMs > 0 || disabled) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(headline.trim());
      
      if (result.success) {
        setHeadline('');
        if (result.cooldownMs) {
          setCooldownMs(result.cooldownMs);
        }
      } else {
        setError(result.error || 'Failed to submit headline');
        if (result.cooldownMs) {
          setCooldownMs(result.cooldownMs);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCooldown = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const isPlaying = phase === 'PLAYING';
  const canSubmit = isPlaying && !disabled && !isSubmitting && cooldownMs <= 0 && headline.trim().length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="headline" className="block text-sm font-medium text-gray-700 mb-1">
            Submit a Headline from the Future
          </label>
          <input
            id="headline"
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={isPlaying ? "Enter your headline..." : "Headlines can only be submitted during the playing phase"}
            maxLength={280}
            disabled={!isPlaying || disabled || isSubmitting}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              !isPlaying || disabled
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-white'
            }`}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{headline.length}/280 characters</span>
            {cooldownMs > 0 && (
              <span className="text-amber-600">
                Next submission in {formatCooldown(cooldownMs)}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            canSubmit
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          ) : cooldownMs > 0 ? (
            `Wait ${formatCooldown(cooldownMs)}`
          ) : !isPlaying ? (
            'Only during Playing phase'
          ) : (
            'Submit Headline'
          )}
        </button>
      </form>
    </div>
  );
}


