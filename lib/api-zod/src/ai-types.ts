import * as z from "zod/v4";

const UserContextSchema = z.object({
  gender: z.string().optional(),
  age: z.number().optional(),
  heightCm: z.number().optional(),
  currentWeight: z.number().optional(),
  targetWeight: z.number().optional(),
  goal: z.string().optional(),
  dailyCalories: z.number().optional(),
  dailyProtein: z.number().optional(),
  dailyCarbs: z.number().optional(),
  dailyFat: z.number().optional(),
  mealsPerDay: z.number().optional(),
});

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const AiChatBody = z.object({
  messages: z.array(ChatMessageSchema),
  userContext: UserContextSchema.optional(),
});

export const AiAnalyzeTextBody = z.object({
  text: z.string(),
  userContext: UserContextSchema.optional(),
});

export const AiAnalyzeImageBody = z.object({
  imageBase64: z.string(),
  mimeType: z.string(),
  userContext: UserContextSchema.optional(),
});

export type AiChatBodyType = z.infer<typeof AiChatBody>;
export type AiAnalyzeTextBodyType = z.infer<typeof AiAnalyzeTextBody>;
export type AiAnalyzeImageBodyType = z.infer<typeof AiAnalyzeImageBody>;
