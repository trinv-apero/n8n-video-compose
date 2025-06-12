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
	targetService: 'ai-core-art-premium', // routing key
	targetFeature: 'image2image', // options
	ttlMessage: 1000 * 60 * 5, // 5 mins
};

type Image2ImagePremiumInput = {
	file: string;
	mode: string;
	style: string;
	positivePrompt: string;
	negativePrompt: string;
	fixHeight: number;
	fixWidth: number;
	fixWidthAndHeight: boolean;
	useControlnet: boolean;
	applyPulid: boolean;
	seed: number;
	fastMode: boolean;
	imageSize: number;
};

export class Image2ImagePremium implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Image2ImagePremium',
		name: 'image2imagePremium',
		icon: 'file:image2image.svg',
		group: ['transform'],
		version: 1,
		defaults: {
			name: 'Image2ImagePremium',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		description: 'Image2ImagePremium',
		properties: [
			{
				displayName: 'Input Image File',
				name: 'file',
				type: 'string',
				default: '',
				description: 'The input image file to transform',
				required: true,
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'string',
				default: 'transform',
				description: 'The transformation mode',
				required: true,
			},
			{
				displayName: 'Style',
				name: 'style',
				type: 'string',
				default: 'fake_value',
				description: 'The style to apply',
				required: true,
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
				displayName: 'Fix Height',
				name: 'fixHeight',
				type: 'number',
				default: null,
				description: 'Fixed height for the output image',
			},
			{
				displayName: 'Fix Width',
				name: 'fixWidth',
				type: 'number',
				default: null,
				description: 'Fixed width for the output image',
			},
			{
				displayName: 'Fix Width and Height',
				name: 'fixWidthAndHeight',
				type: 'boolean',
				default: false,
				description: 'Whether to fix both width and height',
			},
			{
				displayName: 'Use Controlnet',
				name: 'useControlnet',
				type: 'boolean',
				default: false,
				description: 'Whether to use Controlnet',
			},
			{
				displayName: 'Apply PULID',
				name: 'applyPulid',
				type: 'boolean',
				default: false,
				description: 'Whether to apply PULID',
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: null,
				description: 'Seed for reproducible results',
			},
			{
				displayName: 'Fast Mode',
				name: 'fastMode',
				type: 'boolean',
				default: false,
				description: 'Whether to use fast mode',
			},
			{
				displayName: 'Image Size',
				name: 'imageSize',
				type: 'number',
				default: null,
				description: 'Size of the output image',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const processItem = (item: Image2ImagePremiumInput) => {
			return new Promise(async (resolve, reject) => {
				const image2imageEmitter = new AgentEmitter();
				const correlationId = uuidv4();
				const input = {
					file: item.file,
					mode: item.mode,
					style: item.style,
					positivePrompt: item.positivePrompt,
					negativePrompt: item.negativePrompt,
					fixHeight: item.fixHeight,
					fixWidth: item.fixWidth,
					fixWidthAndHeight: item.fixWidthAndHeight,
					useControlnet: item.useControlnet,
					applyPulid: item.applyPulid,
				};

				await rabbitMQClient.consumeQueue(GLOBAL_CONFIG.queueOneTime, async (message) => {
					if (message) {
						const response = (await JsonAIMessageHandler.parseAndValidateMessage(
							message.content as Buffer,
						)) as JsonAIResponse;
						const correlationId = message.properties.correlationId;
						image2imageEmitter.emit(correlationId, response);
					}
				});

				const message = JsonRpcMessageHandler.compressMessage({
					...input,
					targetFeature: CONFIG.targetFeature,
					expectOutputPath: makeOutputDirPath({
						fileInput: item.file,
						targetService: CONFIG.targetService,
						targetFeature: CONFIG.targetFeature,
						correlationId,
					}),
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
					this.logger.error(`${Image2ImagePremium.name} timeout`);
					reject(new Error(`${Image2ImagePremium.name} timeout`));
				}, CONFIG.ttlMessage);

				const handleResponse = (response: JsonAIResponse) => {
					// console.log(`${Image2ImagePremium.name} response received`, {
					// 	response,
					// });
					if (response.errorMessage) {
						reject(new Error(response.errorMessage));
						image2imageEmitter.off(correlationId, handleResponse);
						return;
					}
					clearTimeout(timeout);
					image2imageEmitter.off(correlationId, handleResponse);
					resolve(response?.resultFile?.[0] || '');
				};

				image2imageEmitter.on(correlationId, handleResponse);
			});
		};

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const fileInput = this.getNodeParameter('file', i) as string;
			const mode = this.getNodeParameter('mode', i) as string;
			const style = this.getNodeParameter('style', i) as string;
			const positivePrompt = this.getNodeParameter('positivePrompt', i) as string;
			const negativePrompt = this.getNodeParameter('negativePrompt', i) as string;
			const fixHeight = this.getNodeParameter('fixHeight', i) as number;
			const fixWidth = this.getNodeParameter('fixWidth', i) as number;
			const fixWidthAndHeight = this.getNodeParameter('fixWidthAndHeight', i) as boolean;
			const useControlnet = this.getNodeParameter('useControlnet', i) as boolean;
			const applyPulid = this.getNodeParameter('applyPulid', i) as boolean;
			const seed = this.getNodeParameter('seed', i) as number;
			const fastMode = this.getNodeParameter('fastMode', i) as boolean;
			const imageSize = this.getNodeParameter('imageSize', i) as number;

			const input: Image2ImagePremiumInput = {
				file: fileInput,
				mode,
				style,
				positivePrompt,
				negativePrompt,
				fixHeight,
				fixWidth,
				fixWidthAndHeight,
				useControlnet,
				applyPulid,
				seed,
				fastMode,
				imageSize,
			};

			const response = await processItem(input);

			returnData.push({
				json: {
					response: response as IDataObject,
				},
			});
		}

		console.log(Image2ImagePremium.name, 'Completed', returnData);

		return [returnData];
	}
}
