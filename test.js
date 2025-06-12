const { RabbitMQClient } = require('./dist/services/rabbitmq');

const rabbitMQClient = RabbitMQClient.getInstance();

async function main() {
	await rabbitMQClient.connect();
}

main();
