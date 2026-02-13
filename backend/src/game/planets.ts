/**
 * Planet definitions for the Future Headlines game.
 * Planets represent thematic categories for headlines, themed around Greek/Roman gods.
 */

import { PlanetEntry } from '../llm/jurorPrompt.js';

/**
 * Default planet list for the game.
 * Each planet represents a different aspect or domain of AI development and impact.
 */
export const DEFAULT_PLANETS: PlanetEntry[] = [
  {
    id: 'EARTH',
    description:
      'Nature, environment, climate, agriculture, ecology, sustainability, and natural resources. Headlines about AI impact on the natural world.',
  },
  {
    id: 'MARS',
    description:
      'War, conflict, military, defense, security, weapons, and geopolitical tensions. Headlines about AI in warfare and defense.',
  },
  {
    id: 'MERCURY',
    description:
      'Communication, information, media, journalism, social networks, and messaging. Headlines about AI in information and communication.',
  },
  {
    id: 'VENUS',
    description:
      'Art, beauty, culture, entertainment, creativity, music, and aesthetics. Headlines about AI in creative and cultural domains.',
  },
  {
    id: 'JUPITER',
    description:
      'Power, governance, law, politics, leadership, authority, and institutions. Headlines about AI in government and institutional power.',
  },
  {
    id: 'SATURN',
    description:
      'Time, aging, history, legacy, tradition, and long-term consequences. Headlines about AI effects on society over time.',
  },
  {
    id: 'NEPTUNE',
    description:
      'Dreams, illusion, spirituality, religion, consciousness, and the subconscious. Headlines about AI and human consciousness or spirituality.',
  },
  {
    id: 'URANUS',
    description:
      'Innovation, revolution, disruption, technology breakthroughs, and radical change. Headlines about revolutionary AI developments.',
  },
  {
    id: 'PLUTO',
    description:
      'Transformation, death and rebirth, hidden forces, secrets, and fundamental change. Headlines about AI causing profound societal transformation.',
  },
  {
    id: 'APOLLO',
    description:
      'Knowledge, science, medicine, healing, truth, and enlightenment. Headlines about AI in healthcare, research, and scientific discovery.',
  },
  {
    id: 'ATHENA',
    description:
      'Wisdom, strategy, education, learning, intelligence, and rational thought. Headlines about AI in education and intellectual pursuits.',
  },
  {
    id: 'HEPHAESTUS',
    description:
      'Industry, manufacturing, engineering, craftsmanship, and automation. Headlines about AI in industrial and manufacturing contexts.',
  },
];

/**
 * Get the default planet list.
 */
export function getDefaultPlanets(): PlanetEntry[] {
  return DEFAULT_PLANETS;
}

/**
 * Get a planet by ID.
 */
export function getPlanetById(id: string): PlanetEntry | undefined {
  return DEFAULT_PLANETS.find((p) => p.id === id);
}

/**
 * Get planet IDs only.
 */
export function getPlanetIds(): string[] {
  return DEFAULT_PLANETS.map((p) => p.id);
}
