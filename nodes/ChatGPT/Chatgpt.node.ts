import {
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import OpenAI from 'openai';

export class Chatgpt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ChatGPT',
		name: 'chatgpt',
		icon: 'file:chatgpt.svg',
		group: ['transform'],
		version: 1,
		defaults: {
			name: 'ChatGPT',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		description: 'ChatGPT',
		credentials: [
			{
				name: 'openAiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'gpt-4o-mini',
				description: 'The GPT model to use',
				required: true,
			},
			{
				displayName: 'Instruction',
				name: 'instruction',
				type: 'string',
				default: '',
				description: 'The instruction for the model',
				required: true,
			},
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				default: '',
				description: 'The question to ask the model',
				required: true,
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'string',
				default: 'text',
				description: 'The output format',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			// const model = this.getNodeParameter('model', i) as string;
			// const instruction = this.getNodeParameter('instruction', i) as string;
			// const question = this.getNodeParameter('question', i) as string;
			// const format = this.getNodeParameter('format', i) as string;

			const credential = await this.getCredentials('openAiApi');
			const apiKey = credential.apiKey as string;

			const openAI = new OpenAI({
				apiKey: apiKey,
			});
			const response = await openAI.chat.completions.create({
				model: this.getNodeParameter('model', i) as string,
				messages: [
					{
						role: 'system',
						content: this.getNodeParameter('instruction', i) as string,
					},
					{
						role: 'user',
						content: this.getNodeParameter('question', i) as string,
					},
				],
				response_format: {
					type: this.getNodeParameter('format', i) as 'json_object',
				},
			});
			const content = response.choices[0].message.content as string;

			returnData.push({
				json: {
					message: content,
					apiKey: apiKey,
					timestamp: new Date().toISOString(),
				},
			});
		}

		return [returnData];
	}
}
