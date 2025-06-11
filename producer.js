// write a function to send a message to rabbitmq

const amqp = require('amqplib');

async function sendMessage(message) {
	const connection = await amqp.connect('amqp://localhost:5672');
	const channel = await connection.createChannel();
	// create a exchange name ai-result
	await channel.assertExchange('ai-result', 'direct', { durable: false });
	// create a queue name test-result
	await channel.assertQueue('test-result');
	// bind the queue to the exchange
	await channel.bindQueue('test-result', 'ai-result', 'test-result');
	// send a message to the queue
	channel.sendToQueue('test-result', Buffer.from(message));

    // listen reply to
    channel.consume('test-result', (msg) => {
        console.log(msg.content.toString());
    });
}

sendMessage('Hello, world!' + Math.random());
