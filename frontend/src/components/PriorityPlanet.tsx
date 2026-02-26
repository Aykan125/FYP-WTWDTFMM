import { Card, SectionTitle } from './ui';

interface PriorityPlanetProps {
  planet: string | null;
}

export function PriorityPlanet({ planet }: PriorityPlanetProps) {
  if (!planet) {
    return null;
  }

  return (
    <Card padding="sm">
      <SectionTitle>Priority Planet</SectionTitle>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-violet-700">{planet}</span>
        <span className="text-xs text-gray-400">+3 bonus</span>
      </div>
    </Card>
  );
}
