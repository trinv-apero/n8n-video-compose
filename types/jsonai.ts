import { z } from "zod";

// Define the JSON AI response message schema
export const JsonAIResponseSchema = z.object({
  messageType: z.string(),
  errorMessage: z.string().optional(),
  statusCode: z.number(),
  responseTime: z.number().optional(),
  resultFile: z.array(z.string()).or(z.string()).optional().nullable(),
  imageOriginalWith: z.number().optional(),
  imageOriginalHeight: z.number().optional(),
  nsfw: z.boolean().optional(),
  videoId: z.string().optional(),
  videoStatus: z.string().optional(),
});

// Define the TypeScript types from the schema
export type JsonAIResponse = z.infer<typeof JsonAIResponseSchema>;

// Define error codes
export enum JsonAIErrorCodes {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR_START = -32099,
  SERVER_ERROR_END = -32000,
}
