import os from 'os';

export const GLOBAL_CONFIG = {
	requestExchange: 'ai-request',
	resultExchange: 'ai-result',
	queueOneTime: 'workflow-' + os.hostname(),
};
