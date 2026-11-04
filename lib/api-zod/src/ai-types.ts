import * as z from "zod/v4";

const num = (max: number) => z.number().finite().min(0).max(max).optional();

const UserContextSchema = z.object({
  gender: z.string().max(40).optional(),
  age: num(130),
  heightCm: num(260),
  currentWeight: num(500),
  targetWeight: num(500),
  goal: z.string().max(80).optional(),
  dailyCalories: num(20000),
  dailyProtein: num(2000),
  dailyCarbs: num(3000),
  dailyFat: num(2000),
  mealsPerDay: num(12),
  remainingCal: z.number().finite().min(-20000).max(20000).optional(),
});

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

export const AiChatBody = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(60),
  userContext: UserContextSchema.optional(),
});

export const AiAnalyzeTextBody = z.object({
  text: z.string().min(1).max(300),
  userContext: UserContextSchema.optional(),
});

export const AiAnalyzeImageBody = z.object({
  // ~5 MB of image once decoded; the app downsizes photos well below this.
  imageBase64: z.string().min(100).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  userContext: UserContextSchema.optional(),
});

export type AiChatBodyType = z.infer<typeof AiChatBody>;
export type AiAnalyzeTextBodyType = z.infer<typeof AiAnalyzeTextBody>;
export type AiAnalyzeImageBodyType = z.infer<typeof AiAnalyzeImageBody>;
