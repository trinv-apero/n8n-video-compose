import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RabbitMQApi implements ICredentialType {
	name = 'aperoRabbitMQ';
	displayName = 'RabbitMQ Apero';
	documentationUrl = 'https://www.rabbitmq.com/documentation.html';
	
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: 'localhost',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 5672,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: 'guest',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: 'guest',
		},
		{
			displayName: 'Virtual Host',
			name: 'vhost',
			type: 'string',
			default: '/',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{ $credentials.username }}',
				password: '={{ $credentials.password }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{`http://${$credentials.host}:15672`}}', // RabbitMQ management API port
			url: '/api/whoami',
			method: 'GET',
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};
}
