interface PersonalScoreProps {
  score: number;
}

export function PersonalScore({ score }: PersonalScoreProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 text-center">
      <div className="text-sm text-gray-500 uppercase tracking-wide">Your Score</div>
      <div className="text-3xl font-bold text-indigo-600">{score}</div>
    </div>
  );
}
