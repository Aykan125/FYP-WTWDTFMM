import { z } from 'zod';

// Nickname validation schema
export const nicknameSchema = z
  .string()
  .min(3, 'Nickname must be at least 3 characters')
  .max(20, 'Nickname must be at most 20 characters')
  .regex(
    /^[a-zA-Z0-9\s-]+$/,
    'Nickname can only contain letters, numbers, spaces, and hyphens'
  )
  .transform((val) => val.trim());

// Join code validation schema
export const joinCodeSchema = z
  .string()
  .length(6, 'Join code must be exactly 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Join code must contain only uppercase letters and numbers');

// Request body schemas
export const createSessionSchema = z.object({
  hostNickname: nicknameSchema,
});

export const joinSessionSchema = z.object({
  nickname: nicknameSchema,
});

// Headline validation schema
export const headlineSchema = z
  .string()
  .min(1, 'Headline cannot be empty')
  .max(280, 'Headline must be at most 280 characters')
  .transform((val) => val.trim());

export const submitHeadlineSchema = z.object({
  joinCode: joinCodeSchema,
  headline: headlineSchema,
});

export type CreateSessionBody = z.infer<typeof createSessionSchema>;
export type JoinSessionBody = z.infer<typeof joinSessionSchema>;
export type SubmitHeadlineBody = z.infer<typeof submitHeadlineSchema>;

