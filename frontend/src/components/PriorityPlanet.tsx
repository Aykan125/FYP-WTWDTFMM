import { Card, SectionTitle } from './ui';

interface PriorityPlanetProps {
  planet: string | null;
}

const PLANET_TAGS: Record<string, [string, string, string]> = {
  EARTH:   ['Nature', 'Environment', 'Climate'],
  MARS:    ['War', 'Conflict', 'Military'],
  MERCURY: ['Communication', 'Media', 'Journalism'],
  VENUS:   ['Art', 'Beauty', 'Culture'],
  JUPITER: ['Power', 'Governance', 'Politics'],
  SATURN:  ['Time', 'Aging', 'Legacy'],
  NEPTUNE: ['Dreams', 'Spirituality', 'Consciousness'],
  URANUS:  ['Innovation', 'Revolution', 'Disruption'],
  PLUTO:   ['Transformation', 'Hidden forces', 'Change'],
};

export function PriorityPlanet({ planet }: PriorityPlanetProps) {
  if (!planet) {
    return null;
  }

  const tags = PLANET_TAGS[planet] ?? [];

  return (
    <Card padding="sm">
      <SectionTitle>Priority Planet</SectionTitle>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-violet-700">{planet}</span>
        <span className="text-xs text-gray-400">+3 bonus</span>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
