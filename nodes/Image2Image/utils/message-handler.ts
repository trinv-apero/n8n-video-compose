import { JsonRpcRequestSchema, JsonRpcErrorCodes, type JsonRpcResponse } from '../types/jsonrpc';
import { JsonAIResponse, JsonAIResponseSchema } from '../types/jsonai';
import zlib from 'zlib';
import { ZodError } from 'zod';
import { logger } from './logger';

abstract class BaseMessageHandler {
	static decompressMessage(buffer: Buffer): Buffer {
		try {
			return zlib.gunzipSync(buffer);
		} catch (error) {
			logger.error('Failed to decompress message', { error });
			throw new Error('Failed to decompress message');
		}
	}

	static compressMessage(data: unknown): Buffer {
		try {
			const messageString = JSON.stringify(data);
			return zlib.gzipSync(Buffer.from(messageString));
		} catch (error) {
			logger.error('Failed to compress message', { error });
			throw new Error('Failed to compress message');
		}
	}

	static handleParseError(error: unknown): void {
		if (error instanceof SyntaxError) {
			logger.error('Invalid JSON format', { error });
			throw new Error('Invalid JSON format');
		}
		if (error instanceof Error) {
			logger.error('Invalid message format', { error });
			throw error;
		}
	}
}

export class JsonRpcMessageHandler extends BaseMessageHandler {
	static parseAndValidateMessage<U>(buffer: Buffer): U {
		try {
			const decompressed = this.decompressMessage(buffer);
			const jsonStr = decompressed.toString('utf-8');
			const json = JSON.parse(jsonStr);
			logger.debug('Received raw JSON-RPC request', { messageRaw: json });
			return JsonRpcRequestSchema.parse(json) as U;
		} catch (error) {
			this.handleParseError(error);
			throw error;
		}
	}

	static createErrorResponse(
		code: number,
		message: string,
		id: string | number | null,
		data?: unknown,
	): JsonRpcResponse {
		return {
			jsonrpc: '2.0',
			error: {
				code,
				message,
				data,
			},
			id,
		};
	}

	static createSuccessResponse(id: string | number | null, result: unknown): JsonRpcResponse {
		return {
			jsonrpc: '2.0',
			result,
			id,
		};
	}

	protected handleParseError(error: unknown): void {
		if (error instanceof SyntaxError) {
			throw JsonRpcMessageHandler.createErrorResponse(
				JsonRpcErrorCodes.PARSE_ERROR,
				'Invalid JSON format',
				null,
			);
		}
		if (error instanceof Error || error instanceof ZodError) {
			throw JsonRpcMessageHandler.createErrorResponse(
				JsonRpcErrorCodes.INVALID_REQUEST,
				error.message,
				null,
			);
		}
	}
}

export class JsonAIMessageHandler extends BaseMessageHandler {
	static parseAndValidateMessage<U>(buffer: Buffer): U {
		try {
			const decompressed = this.decompressMessage(buffer);
			const jsonStr = decompressed.toString('utf-8');
			const json = JSON.parse(jsonStr);
			logger.debug('Received raw JSON-AI request', { messageRaw: json });
			return JsonAIResponseSchema.parse(json) as U;
		} catch (error) {
			this.handleParseError(error);
			throw error;
		}
	}
	static createErrorResponse(
		statusCode: number,
		errorMessage: string,
		responseTime?: number,
	): JsonAIResponse {
		return {
			messageType: 'error',
			errorMessage,
			statusCode,
			responseTime,
			resultFile: [],
		};
	}

	static createSuccessResponse(
		resultFile: string[],
		options?: {
			responseTime?: number;
			imageOriginalWith?: number;
			imageOriginalHeight?: number;
			nsfw?: boolean;
		},
	): JsonAIResponse {
		return {
			messageType: 'success',
			statusCode: 200,
			resultFile,
			...options,
		};
	}
}
