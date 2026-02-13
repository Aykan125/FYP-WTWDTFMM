
interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: string;
  totalScore?: number;
}

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
}

export function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        Players ({players.length})
      </h2>
      
      {players.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No players yet</p>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                player.id === currentPlayerId
                  ? 'bg-blue-50 border-2 border-blue-300'
                  : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    player.isHost ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                />
                <span className="font-medium text-gray-800">
                  {player.nickname}
                  {player.id === currentPlayerId && ' (You)'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-indigo-600 font-semibold">
                  {player.totalScore ?? 0} pts
                </span>
                {player.isHost && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">
                    HOST
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

