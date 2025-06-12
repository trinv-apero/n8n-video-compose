import amqp from 'amqplib';
import { asyncLocalStorage } from '../utils/async-storage';
import os from 'os';

const configWorkflow = {
	queue: 'workflow-queue-local',
	requestExchange: 'ai-request',
	resultExchange: 'ai-result',
	queueOneTime: 'workflow-' + os.hostname(),
};

export class RabbitMQClient {
	private static instance: RabbitMQClient | null = null;
	private connection: amqp.ChannelModel | null = null;
	private channel: amqp.Channel | null = null;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 5;
	private readonly reconnectInterval = 5000; // 5 seconds
	private consumers: Map<string, (msg: amqp.ConsumeMessage | null) => Promise<void>> = new Map();

	private constructor() {
		this.handleDisconnect = this.handleDisconnect.bind(this);
	}

	public static getInstance(): RabbitMQClient {
		if (!RabbitMQClient.instance) {
			RabbitMQClient.instance = new RabbitMQClient();
		}
		return RabbitMQClient.instance;
	}

	private async createConnection(): Promise<amqp.ChannelModel> {
		return await amqp.connect({
			hostname: '66.42.43.42',
			port: 5672,
			username: 'aiServiceDev',
			password: 'VeryStrongPassword123',
			vhost: '/',
			heartbeat: 60,
		});
	}

	private async handleDisconnect(): Promise<void> {
		this.reconnectAttempts++;

		if (this.reconnectAttempts <= this.maxReconnectAttempts) {
			console.warn(
				`Connection to RabbitMQ lost. Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
			);

			try {
				await new Promise((resolve) => setTimeout(resolve, this.reconnectInterval));
				await this.connect();

				// Reestablish consumers after reconnection
				for (const [queue, callback] of this.consumers.entries()) {
					await this.consumeQueue(queue, callback);
				}

				this.reconnectAttempts = 0; // Reset counter on successful reconnection
				console.log('Successfully reconnected to RabbitMQ and restored consumers');
			} catch (error) {
				console.error('Failed to reconnect to RabbitMQ', { error });
				if (this.reconnectAttempts === this.maxReconnectAttempts) {
					console.error('Max reconnection attempts reached. Exiting...');
					process.exit(1);
				}
			}
		}
	}

	public async connect(): Promise<void> {
		try {
			this.connection = await this.createConnection();
			if (!this.connection) {
				throw new Error('Failed to create connection');
			}

			// Setup connection event handlers
			this.connection.on('error', this.handleDisconnect);
			this.connection.on('close', this.handleDisconnect);

			this.channel = await this.connection.createChannel();
			if (!this.channel) {
				throw new Error('Failed to create channel');
			}

			await this.setupQueues();
			console.log('Connected to RabbitMQ');
		} catch (error) {
			console.error('Failed to connect to RabbitMQ', { error });
			await this.handleDisconnect();
		}
	}

	private async setupQueues(): Promise<void> {
		if (!this.channel) {
			throw new Error('Channel not initialized');
		}

		// Setup queue
		await this.channel.assertQueue(configWorkflow.queue, {
			durable: true,
			autoDelete: false,
		});

		await this.channel.bindQueue(
			configWorkflow.queue,
			configWorkflow.requestExchange,
			configWorkflow.queue,
		);

		// Setup queue onetime
		await this.channel.assertQueue(configWorkflow.queueOneTime, {
			durable: true,
			autoDelete: true,
		});

		await this.channel.bindQueue(
			configWorkflow.queueOneTime,
			configWorkflow.resultExchange,
			configWorkflow.queueOneTime,
		);
	}

	public async consumeQueue(
		queue: string,
		onMessage: (msg: amqp.ConsumeMessage | null) => Promise<void>,
	): Promise<void> {
		if (!this.channel) {
			throw new Error('Channel not initialized');
		}

		// Store the consumer callback for reconnection
		this.consumers.set(queue, onMessage);

		await this.channel.consume(queue, async (message) => {
			const correlationId = message?.properties?.correlationId;
			asyncLocalStorage.run({ correlationId }, async () => {
				try {
					await onMessage(message);
					if (message && this.channel) {
						this.channel.ack(message);
					}
				} catch (error) {
					console.error('Error processing message', {
						error,
					});
					// Nack the message if processing fails
					if (message && this.channel) {
						this.channel.nack(message);
					}
				}
			});
		});
	}

	public async sendToQueue(
		queue: string,
		content: Buffer,
		options?: amqp.Options.Publish,
	): Promise<boolean> {
		if (!this.channel) {
			throw new Error('Channel not initialized');
		}

		return this.channel.sendToQueue(queue, content, options);
	}

	public async publish(
		content: Buffer,
		exchange: string,
		routingKey: string,
		options?: amqp.Options.Publish,
	): Promise<boolean> {
		if (!this.channel) {
			throw new Error('Channel not initialized');
		}

		return this.channel.publish(exchange, routingKey, content, {
			...(options ?? {}),
			persistent: true,
		});
	}

	public async close(): Promise<void> {
		try {
			if (this.channel) {
				await this.channel.close();
			}
			if (this.connection) {
				await this.connection.close();
			}
			console.log('RabbitMQ connection closed');
		} catch (error) {
			console.error('Error closing RabbitMQ connection', { error });
			throw error;
		}
	}
}
