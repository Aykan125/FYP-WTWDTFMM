import { Card, SectionTitle } from './ui';

interface InGameDateProps {
  inGameNow: string | null;
}

export function InGameDate({ inGameNow }: InGameDateProps) {
  if (!inGameNow) return null;

  const date = new Date(inGameNow);
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card padding="sm">
      <SectionTitle>Current Period</SectionTitle>
      <span className="text-sm font-medium text-gray-700">{formatted}</span>
    </Card>
  );
}
