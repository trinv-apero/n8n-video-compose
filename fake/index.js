import { connect } from 'amqplib/callback_api.js';
import zlib from 'zlib';

const log = (message, ...optionalParams) => {
	console.log(`${process.pid} - ${message}`, ...optionalParams);
};

connect(
	{
		protocol: 'amqp',
		hostname: 'localhost',
		port: 5672,
		username: 'guest',
		password: 'guest',
		vhost: '/',
		// protocol: "amqp",
		// hostname: "66.42.43.42",
		// port: 5672,
		// username: "aiServiceDev",
		// password: "VeryStrongPassword123",
		// vhost: "/",
	},
	{
		clientProperties: {
			connection_name: 'ai-core-video-lite',
		},
	},
	function (error0, connection) {
		if (error0) {
			throw error0;
		}

		connection.createChannel(function (error1, channel) {
			if (error1) {
				throw error1;
			}

			channel.prefetch(10);
			log(' [x] Awaiting RPC requests');

			const exchangeRequest = 'ai-request';
			const exchangeResult = 'ai-result';

			channel.assertExchange(exchangeRequest, 'direct', {
				durable: false,
			});

			// Queue outpainting
			const queueOutpainting = 'ai-core-outpainting';
			channel.assertQueue(queueOutpainting, {
				durable: true,
			});

			channel.bindQueue(queueOutpainting, exchangeRequest, queueOutpainting);

			channel.consume(queueOutpainting, function reply(msg) {
				const strContent = zlib.gunzipSync(msg.content).toString('utf-8');
				const jsonContent = JSON.parse(strContent);
				log(' [x] Receive message: ', jsonContent);

				// Simulate processing time
				setTimeout(() => {
					console.log('publish status preparing', msg.properties.replyTo);
					const response = {
						resultFile: [`image-premium/${msg.properties.correlationId}/0.jpg`],
						messageType: 'success',
						imageStatus: 'active',
						statusCode: 200,
					};
					const content = zlib.gzipSync(JSON.stringify(response));
					channel.publish(exchangeResult, msg.properties.replyTo, content, {
						correlationId: msg.properties.correlationId,
					});
				}, 500);

				channel.ack(msg);
			});

			// Queue art premium
			const queueArtPremium = 'ai-core-art-premium';
			channel.assertQueue(queueArtPremium, {
				durable: true,
			});

			channel.bindQueue(queueArtPremium, exchangeRequest, queueArtPremium);

			channel.consume(queueArtPremium, function reply(msg) {
				const strContent = zlib.gunzipSync(msg.content).toString('utf-8');
				const jsonContent = JSON.parse(strContent);
				log(' [x] Receive message: art premium', jsonContent);

				// Simulate processing time with random delay between 30s and 1m
				const minDelay = 5*1000; // 30 seconds
				const maxDelay = 10 * 1000; // 1 minute
				const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

				setTimeout(() => {
					console.log('publish status preparing', msg.properties.replyTo);
					const response = {
						resultFile: [`image-premium/${msg.properties.correlationId}/0.jpg`],
						messageType: 'success',
						imageStatus: 'active',
						statusCode: 200,
					};
					const content = zlib.gzipSync(JSON.stringify(response));
					channel.publish(exchangeResult, msg.properties.replyTo, content, {
						correlationId: msg.properties.correlationId,
					});
				}, randomDelay);

				channel.ack(msg);
			});
		});
	},
);
