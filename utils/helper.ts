import moment from 'moment';
import path from "path"

type MakeOutputDirPath1Params = {
	fileInput?: string;
	targetService?: string;
	targetFeature?: string;
	correlationId?: string;
};

export const makeInputDirPath = (
	targetService: string,
	targetFeature: string,
	correlationId: string,
) => {
	const now = moment();
	let yyyymmdd = now.format('YYYY-MM-DD');
	const endOfDay = now.endOf('day');
	if (endOfDay.diff(now, 'minutes') <= 1) {
		yyyymmdd = now.add(1, 'days').format('YYYY-MM-DD');
	}

	const dirTree = [targetService, targetFeature, yyyymmdd, correlationId].filter((e) => e);

	return dirTree.join('/');
};

export const makeOutputDirPath = (params: MakeOutputDirPath1Params) => {
	if (!params.fileInput) {
		const dir = makeInputDirPath(
			params.targetService!,
			params.targetFeature!,
			params.correlationId!,
		);

		return path.join(dir, 'output');
	}

	const extname = path.extname(params.fileInput);
	if (extname) {
		return path.join(path.dirname(params.fileInput), 'output', extname);
	}

	return path.join(params.fileInput, 'output');
};
