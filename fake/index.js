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

			// Queue image
			const queueImage = 'image2image';
			channel.assertQueue(queueImage, {
				durable: true,
			});

			channel.bindQueue(queueImage, exchangeRequest, queueImage);

			channel.consume(queueImage, function reply(msg) {
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
		});
	},
);
