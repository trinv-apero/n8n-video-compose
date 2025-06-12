import * as winston from "winston";
import { asyncLocalStorage } from "./async-storage";

const { format, transports } = winston;
const { combine, timestamp, printf, colorize } = format;

const customFormat = printf((info: winston.Logform.TransformableInfo) => {
  const store = asyncLocalStorage.getStore();
  if (store && store.correlationId && !info.correlationId) {
    info.correlationId = store.correlationId;
  }

  const {
    level,
    message,
    timestamp,
    correlationId,
    module,
    feature,
    error,
    ...metadata
  } = info;

  const metaStr = Object.keys(metadata).length
    ? ` ${JSON.stringify(metadata)}`
    : "";

  const LEVEL = level.toUpperCase();
  const TIMESTAMP = timestamp;
  const CORRELATION_ID = correlationId ? `[${correlationId}]` : "";
  const PATH = info.path ? `[${info.path}]` : "";
  const MODULE = module || "";
  const FEATURE = feature || "";

  const combines = [LEVEL, TIMESTAMP, CORRELATION_ID, PATH, MODULE, FEATURE];

  if (error) {
    const ERROR = `${(error as Error)?.name} | ${
      (error as Error)?.message
    } | ${JSON.stringify((error as Error)?.stack)}`;
    combines.push(ERROR);
  }

  return [...combines, message, metaStr].filter((i) => i).join(" ");
});

const developmentFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  customFormat
);

export const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  level: "info",
  format: developmentFormat,
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

export interface LogContext {
  correlationId?: string;
  module?: string;
  feature?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

export function createContextLogger(context: Record<string, any>) {
  return logger.child(context);
}
