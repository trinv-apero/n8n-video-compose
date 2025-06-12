import {
	IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { v4 as uuidv4 } from 'uuid';
import { makeOutputDirPath } from '../../utils/helper';
import { RabbitMQClient } from '../../services/rabbitmq';
import { JsonAIMessageHandler, JsonRpcMessageHandler } from '../../utils/message-handler';
import { JsonAIResponse } from '../../types/jsonai';
import { AgentEmitter } from '../../events/eventEmitter';
import { GLOBAL_CONFIG } from '../../config';

const rabbitMQClient = RabbitMQClient.getInstance();
rabbitMQClient.connect();

const CONFIG = {
	targetService: 'ai-core-video-lite',
	targetFeature: 'video-lite',
	ttlMessage: 1000 * 60 * 10, // 5 mins
};

export enum VideoStatus {
	QUEUEING = 'queueing',
	PROCESSING = 'processing',
	RENDERING = 'rendering',
	COMPLETED = 'completed',
	FAILED = 'failed',
}

export interface VideoLiteRequest {
	videoId?: string;
	videoStatus?: VideoStatus;
	file?: string;
	file2?: string;
	mode?: string;
	morphFiles?: string[];
	positivePrompt?: string;
	negativePrompt?: string;
	backgroundPrompt?: string;
	frameNumber?: number;
	frameRate?: number;
	width?: number;
	height?: number;
	guidanceScale?: number;
	steps?: number;
	imageSize?: number;
	useImageCaption?: boolean;
	useFrameInterpolation?: boolean;
	enableSwapface?: boolean;
	enableInpaint?: boolean;
	upscalerXTimes?: number;
	loraName?: string;
	additionalOptions?: string[];
	enableAssistant?: boolean;
	seed?: number;
}

export class VideoLite implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'VideoLite',
		name: 'videoLite',
		icon: 'file:video-lite.svg',
		group: ['transform'],
		version: 1,
		defaults: {
			name: 'VideoLite',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		description: 'Video generation with lite features',
		properties: [
			{
				displayName: 'Image 01',
				name: 'file',
				type: 'string',
				default: '',
				description: 'The input video file to transform',
				required: true,
			},
			{
				displayName: 'Image 02',
				name: 'file2',
				type: 'string',
				default: '',
				description: 'Second input file (optional)',
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{
						name: 'Fusion',
						value: 'fusion',
					},
					{
						name: 'Hugging',
						value: 'hugging',
					},
					{
						name: 'Image to Video',
						value: 'i2v',
					},
					{
						name: 'Image to Video Premium',
						value: 'i2vp',
					},
					{
						name: 'Kissing',
						value: 'kissing',
					},
					{
						name: 'Muscle',
						value: 'muscle',
					},
					{
						name: 'Passionate Kissing',
						value: 'passionateKissing',
					},
					{
						name: 'Text to GIF',
						value: 't2g',
					},
				],
				default: 'i2v',
				description: 'The transformation mode',
				required: true,
			},
			{
				displayName: 'Morph Files',
				name: 'morphFiles',
				type: 'string',
				default: '',
				description: 'Files for morphing',
			},
			{
				displayName: 'Positive Prompt',
				name: 'positivePrompt',
				type: 'string',
				default: '',
				description: 'Positive prompt to guide the transformation',
			},
			{
				displayName: 'Negative Prompt',
				name: 'negativePrompt',
				type: 'string',
				default: '',
				description: 'Negative prompt to guide the transformation',
			},
			{
				displayName: 'Background Prompt',
				name: 'backgroundPrompt',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Frame Number',
				name: 'frameNumber',
				type: 'number',
				default: 30,
				description: 'Number of frames',
			},
			{
				displayName: 'Frame Rate',
				name: 'frameRate',
				type: 'number',
				default: 30,
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				default: 512,
				description: 'Width of output',
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				default: 512,
				description: 'Height of output',
			},
			{
				displayName: 'Guidance Scale',
				name: 'guidanceScale',
				type: 'number',
				default: 7.5,
				description: 'Guidance scale for generation',
			},
			{
				displayName: 'Steps',
				name: 'steps',
				type: 'number',
				default: 20,
				description: 'Number of inference steps',
			},
			{
				displayName: 'Image Size',
				name: 'imageSize',
				type: 'number',
				default: 512,
				description: 'Size of generated images',
			},
			{
				displayName: 'Use Image Caption',
				name: 'useImageCaption',
				type: 'boolean',
				default: false,
				description: 'Whether to use image captioning',
			},
			{
				displayName: 'Use Frame Interpolation',
				name: 'useFrameInterpolation',
				type: 'boolean',
				default: false,
				description: 'Whether to use frame interpolation',
			},
			{
				displayName: 'Enable Swapface',
				name: 'enableSwapface',
				type: 'boolean',
				default: false,
				description: 'Whether to enable face swapping',
			},
			{
				displayName: 'Enable Inpaint',
				name: 'enableInpaint',
				type: 'boolean',
				default: false,
				description: 'Whether to enable inpainting',
			},
			{
				displayName: 'Upscaler X Times',
				name: 'upscalerXTimes',
				type: 'number',
				default: 1,
				description: 'Upscaling factor',
			},
			{
				displayName: 'Lora Name',
				name: 'loraName',
				type: 'string',
				default: '',
				description: 'Name of LoRA model to use',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'string',
				default: '',
				description: 'Additional processing options',
			},
			{
				displayName: 'Enable Assistant',
				name: 'enableAssistant',
				type: 'boolean',
				default: false,
				description: 'Whether to enable AI assistant',
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: -1,
				description: 'Seed for reproducible results',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const processItem = (item: VideoLiteRequest) => {
			return new Promise(async (resolve, reject) => {
				const videoLiteEmitter = new AgentEmitter();
				const correlationId = uuidv4();
				const videoId = uuidv4();

				const message = JsonRpcMessageHandler.compressMessage({
					...item,
					videoId,
					videoStatus: VideoStatus.QUEUEING,
					targetFeature: CONFIG.targetFeature,
					expectOutputPath: makeOutputDirPath({
						fileInput: item.file || '',
						targetService: CONFIG.targetService,
						targetFeature: CONFIG.targetFeature,
						correlationId,
					}),
				});

				await rabbitMQClient.consumeQueue(GLOBAL_CONFIG.queueOneTime, async (message) => {
					if (message) {
						const response = (await JsonAIMessageHandler.parseAndValidateMessage(
							message.content as Buffer,
						)) as JsonAIResponse;
						const correlationId = message.properties.correlationId;
						videoLiteEmitter.emit(correlationId, response);
					}
				});

				const success = await rabbitMQClient.publish(
					message,
					GLOBAL_CONFIG.requestExchange,
					CONFIG.targetService,
					{
						replyTo: GLOBAL_CONFIG.queueOneTime,
						correlationId,
					},
				);

				if (!success) {
					throw new NodeOperationError(this.getNode(), 'Failed to publish message to RabbitMQ');
				}

				const timeout = setTimeout(() => {
					this.logger.error(`${VideoLite.name} timeout`);
					reject(new Error(`${VideoLite.name} timeout`));
				}, CONFIG.ttlMessage);

				const handleResponse = (response: JsonAIResponse) => {
					console.log(`${VideoLite.name} response received`, {
						response,
					});

					if (response.videoStatus === VideoStatus.COMPLETED) {
						clearTimeout(timeout);
						videoLiteEmitter.off(correlationId, handleResponse);
						resolve(response?.resultFile);
						return;
					}

					if (response.errorMessage) {
						reject(new Error(response.errorMessage));
						videoLiteEmitter.off(correlationId, handleResponse);
						return;
					}
				};

				videoLiteEmitter.on(correlationId, handleResponse);
			});
		};

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const input: VideoLiteRequest = {
				file: this.getNodeParameter('file', i) as string,
				file2: this.getNodeParameter('file2', i) as string,
				mode: this.getNodeParameter('mode', i) as string,
				morphFiles: (this.getNodeParameter('morphFiles', i) as string).split(','),
				positivePrompt: this.getNodeParameter('positivePrompt', i) as string,
				negativePrompt: this.getNodeParameter('negativePrompt', i) as string,
				backgroundPrompt: this.getNodeParameter('backgroundPrompt', i) as string,
				frameNumber: this.getNodeParameter('frameNumber', i) as number,
				frameRate: this.getNodeParameter('frameRate', i) as number,
				width: this.getNodeParameter('width', i) as number,
				height: this.getNodeParameter('height', i) as number,
				guidanceScale: this.getNodeParameter('guidanceScale', i) as number,
				steps: this.getNodeParameter('steps', i) as number,
				imageSize: this.getNodeParameter('imageSize', i) as number,
				useImageCaption: this.getNodeParameter('useImageCaption', i) as boolean,
				useFrameInterpolation: this.getNodeParameter('useFrameInterpolation', i) as boolean,
				enableSwapface: this.getNodeParameter('enableSwapface', i) as boolean,
				enableInpaint: this.getNodeParameter('enableInpaint', i) as boolean,
				upscalerXTimes: this.getNodeParameter('upscalerXTimes', i) as number,
				loraName: this.getNodeParameter('loraName', i) as string,
				additionalOptions: (this.getNodeParameter('additionalOptions', i) as string).split(','),
				enableAssistant: this.getNodeParameter('enableAssistant', i) as boolean,
				seed: this.getNodeParameter('seed', i) as number,
			};

			const response = await processItem(input);

			returnData.push({
				json: {
					response: response as IDataObject,
				},
			});
		}

		console.log(VideoLite.name, 'Completed', returnData);

		return [returnData];
	}
}
