// write a function to listen to a message from rabbitmq

const amqp = require('amqplib');

async function listenToMessage() {
	const connection = await amqp.connect('amqp://localhost:5672');
	const channel = await connection.createChannel();

	// receive message from queue test-result from exchange ai-result
	await channel.assertQueue('test-result');
	await channel.consume('test-result', (msg) => {
		console.log(msg.content.toString());
      

        // send back to the producer
        channel.publish('ai-result', msg.properties.replyTo, Buffer.from('Fucking reply!'));
	}, {
        noAck: true
    });
}

listenToMessage();
