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
import { makeOutputDirPath } from './lib';
import { RabbitMQClient } from './rabbitmq';
import { JsonAIMessageHandler, JsonRpcMessageHandler } from './utils/message-handler';
import os from 'os';
import { JsonAIResponse } from './types/jsonai';
import { image2imageEmitter } from './events/eventEmitter';

const rabbitMQClient = RabbitMQClient.getInstance();
rabbitMQClient.connect();

const CONFIG = {
	targetService: 'image2image',
	targetFeature: 'image2image',
	requestExchange: 'ai-request',
	resultExchange: 'ai-result',
	queueOneTime: 'workflow-' + os.hostname(),
	ttlMessage: 1000 * 60, // 1 min
};

export class Image2Image implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Image2Image',
		name: 'image2image',
		icon: 'file:image2image.svg',
		group: ['transform'],
		version: 1,
		defaults: {
			name: 'Image2Image',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		description: 'Image2Image',
		properties: [
			{
				displayName: 'File',
				name: 'file',
				type: 'string',
				default: '',
				description: 'The input image file',
				required: true,
			},
			{
				displayName: 'Another File',
				name: 'anotherFile',
				type: 'string',
				default: '',
				description: 'The second input image file',
				required: true,
			},
			{
				displayName: 'Style Combine Background',
				name: 'styleCombineBackground',
				type: 'string',
				default: '',
				description: 'The style to combine with the background',
				required: true,
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				description: 'The prompt to guide the image transformation',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const processItem = (item: {
			file: string;
			anotherFile: string;
			styleCombineBackground: string;
			prompt: string;
		}) => {
			return new Promise(async (resolve, reject) => {
				const correlationId = uuidv4();
				const input = {
					file: item.file,
					anotherFile: item.anotherFile,
					styleCombineBackground: item.styleCombineBackground,
					prompt: item.prompt,
				};

				await rabbitMQClient.consumeQueue(CONFIG.queueOneTime, async (message) => {
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
					CONFIG.requestExchange,
					CONFIG.targetService,
					{
						replyTo: CONFIG.queueOneTime,
						correlationId,
					},
				);

				if (!success) {
					throw new NodeOperationError(this.getNode(), 'Failed to publish message to RabbitMQ');
				}

				const timeout = setTimeout(() => {
					this.logger.error(`${Image2Image.name} timeout`);
					reject(new Error(`${Image2Image.name} timeout`));
				}, CONFIG.ttlMessage);

				const handleResponse = (response: JsonAIResponse) => {
					console.log(`${Image2Image.name} response received`, {
						response,
					});
					if (response.errorMessage) {
						reject(new Error(response.errorMessage));
						image2imageEmitter.off(correlationId, handleResponse);
						return;
					}
					resolve(response?.resultFile?.[0] || '');
					clearTimeout(timeout);
					image2imageEmitter.off(correlationId, handleResponse);
				};

				image2imageEmitter.once(correlationId, handleResponse);
			});
		};

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const fileInput = this.getNodeParameter('file', i) as string;
			const anotherFile = this.getNodeParameter('anotherFile', i) as string;
			const styleCombineBackground = this.getNodeParameter('styleCombineBackground', i) as string;
			const prompt = this.getNodeParameter('prompt', i) as string;

			const response = await processItem({
				file: fileInput,
				anotherFile: anotherFile,
				styleCombineBackground: styleCombineBackground,
				prompt: prompt,
			});

			returnData.push({
				json: {
					response: response as IDataObject,
				},
			});
		}

		return [returnData];
	}
}
