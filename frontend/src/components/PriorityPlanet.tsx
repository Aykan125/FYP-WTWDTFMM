interface PriorityPlanetProps {
  planet: string | null;
}

export function PriorityPlanet({ planet }: PriorityPlanetProps) {
  if (!planet) {
    return <span className="text-gray-400 text-sm">No priority yet</span>;
  }

  return (
    <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
      <span className="text-purple-600 font-medium">Priority:</span>
      <span className="text-purple-800 font-bold">{planet}</span>
      <span className="text-purple-500 text-sm">+3 bonus if matched</span>
    </div>
  );
}
