import { z } from 'zod';

// JSON-RPC 2.0 request schema
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.unknown().optional(),
  id: z.union([z.number(), z.string(), z.null()]),
});

// JSON-RPC 2.0 response schema
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  id: z.union([z.number(), z.string(), z.null()]),
}).refine(data => {
  // Either result or error must be present, but not both
  return (data.result !== undefined) !== (data.error !== undefined);
}, {
  message: "Response must have either 'result' or 'error', but not both",
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// JSON-RPC 2.0 error codes
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
