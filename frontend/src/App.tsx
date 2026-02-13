import { useState, useEffect } from 'react';
import { HostLobby } from './components/HostLobby';
import { JoinLobby } from './components/JoinLobby';
import { useSocket } from './hooks/useSocket';

type Screen = 'home' | 'host' | 'join';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [nickname, setNickname] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Session data stored in localStorage
  const [sessionData, setSessionData] = useState<{
    joinCode: string;
    playerId: string;
    isHost: boolean;
  } | null>(null);

  const { connected, sessionState, headlines, roundSummary, joinLobby, leaveLobby, startGame, submitHeadline, loadHeadlines, requestSummary } = useSocket();

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('futureHeadlines_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSessionData(parsed);
        // Automatically rejoin the lobby
        if (parsed.joinCode && parsed.playerId) {
          joinLobby(parsed.joinCode, parsed.playerId);
          setScreen(parsed.isHost ? 'host' : 'join');
        }
      } catch (err) {
        console.error('Failed to parse stored session:', err);
        localStorage.removeItem('futureHeadlines_session');
      }
    }
  }, []);

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (sessionData) {
      localStorage.setItem('futureHeadlines_session', JSON.stringify(sessionData));
    }
  }, [sessionData]);

  const handleCreateSession = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostNickname: nickname.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();
      const newSessionData = {
        joinCode: data.session.joinCode,
        playerId: data.player.id,
        isHost: true,
      };

      setSessionData(newSessionData);

      // Join the socket.io lobby
      const joined = await joinLobby(data.session.joinCode, data.player.id);
      if (joined) {
        setScreen('host');
      } else {
        setError('Failed to connect to lobby');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (!joinCodeInput.trim()) {
      setError('Please enter a join code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const code = joinCodeInput.trim().toUpperCase();
      const response = await fetch(`${API_URL}/api/sessions/${code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to join session');
      }

      const data = await response.json();
      const newSessionData = {
        joinCode: data.session.joinCode,
        playerId: data.player.id,
        isHost: false,
      };

      setSessionData(newSessionData);

      // Join the socket.io lobby
      const joined = await joinLobby(data.session.joinCode, data.player.id);
      if (joined) {
        setScreen('join');
      } else {
        setError('Failed to connect to lobby');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    leaveLobby();
    setSessionData(null);
    localStorage.removeItem('futureHeadlines_session');
    setScreen('home');
    setNickname('');
    setJoinCodeInput('');
    setError('');
  };

  const handleStartGame = async () => {
    if (!sessionData) return;

    const success = await startGame(sessionData.joinCode);
    if (success) {
      // Game started - could navigate to game screen
      console.log('Game started!');
    }
  };

  const handleSubmitHeadline = async (headline: string) => {
    if (!sessionData) {
      return { success: false, error: 'Not connected to a session' };
    }
    return submitHeadline(sessionData.joinCode, headline);
  };

  // Load headlines when the phase changes to PLAYING
  useEffect(() => {
    if (sessionState?.phase === 'PLAYING' && sessionData?.joinCode) {
      loadHeadlines(sessionData.joinCode);
    }
  }, [sessionState?.phase, sessionData?.joinCode, loadHeadlines]);

  // Request round summary on reconnect during BREAK phase
  useEffect(() => {
    if (sessionState?.phase === 'BREAK' && sessionData?.joinCode && !roundSummary) {
      requestSummary(sessionData.joinCode, sessionState.currentRound);
    }
  }, [sessionState?.phase, sessionState?.currentRound, sessionData?.joinCode, roundSummary, requestSummary]);

  // Home screen
  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-2">
              Future Headlines
            </h1>
            <p className="text-gray-600">Create or join a game session</p>
          </div>

          {/* Connection Status */}
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-700">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Nickname Input */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                maxLength={20}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Create Session Button */}
            <button
              onClick={handleCreateSession}
              disabled={loading || !connected}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Creating...' : 'Create New Session'}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Join Code Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Join Code
              </label>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-center text-lg tracking-wider"
                maxLength={6}
              />
            </div>

            {/* Join Session Button */}
            <button
              onClick={handleJoinSession}
              disabled={loading || !connected}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Joining...' : 'Join Session'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Host lobby screen
  if (screen === 'host' && sessionState) {
    return (
      <HostLobby
        joinCode={sessionState.joinCode}
        players={sessionState.players}
        currentPlayerId={sessionData?.playerId || ''}
        phase={sessionState.phase}
        currentRound={sessionState.currentRound}
        maxRounds={sessionState.maxRounds}
        playMinutes={sessionState.playMinutes}
        phaseStartedAt={sessionState.phaseStartedAt}
        phaseEndsAt={sessionState.phaseEndsAt}
        serverNow={sessionState.serverNow}
        inGameNow={sessionState.inGameNow}
        headlines={headlines}
        roundSummary={roundSummary}
        onStartGame={handleStartGame}
        onBack={handleBack}
        onSubmitHeadline={handleSubmitHeadline}
      />
    );
  }

  // Join lobby screen
  if (screen === 'join' && sessionState) {
    return (
      <JoinLobby
        joinCode={sessionState.joinCode}
        players={sessionState.players}
        currentPlayerId={sessionData?.playerId || ''}
        isHost={sessionData?.isHost || false}
        phase={sessionState.phase}
        currentRound={sessionState.currentRound}
        maxRounds={sessionState.maxRounds}
        playMinutes={sessionState.playMinutes}
        phaseStartedAt={sessionState.phaseStartedAt}
        phaseEndsAt={sessionState.phaseEndsAt}
        serverNow={sessionState.serverNow}
        inGameNow={sessionState.inGameNow}
        headlines={headlines}
        roundSummary={roundSummary}
        onBack={handleBack}
        onSubmitHeadline={handleSubmitHeadline}
      />
    );
  }

  // Loading state
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default App;

