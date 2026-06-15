const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'info';
};

// Define log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
        const { timestamp, level, message, tag, ...meta } = info;
        const tagStr = tag ? `[${tag}]` : '';
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `${timestamp} ${level} ${tagStr} ${message}${metaStr}`;
    })
);

// Define transports
const transports = [
    // Console transport for all environments
    new winston.transports.Console({
        format: consoleFormat,
    }),
];

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Error log file - only errors
    transports.push(
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d',
            format: format,
        })
    );

    // Combined log file - all logs
    transports.push(
        new DailyRotateFile({
            filename: path.join(logsDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: format,
        })
    );

    // HTTP request log file
    transports.push(
        new DailyRotateFile({
            filename: path.join(logsDir, 'http-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'http',
            maxSize: '20m',
            maxFiles: '7d',
            format: format,
        })
    );
}

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
    exitOnError: false,
});

// Create a stream object for Morgan HTTP middleware
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Helper methods for tagged logging
logger.tagged = (tag) => ({
    error: (message, meta = {}) => logger.error(message, { tag, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { tag, ...meta }),
    info: (message, meta = {}) => logger.info(message, { tag, ...meta }),
    http: (message, meta = {}) => logger.http(message, { tag, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { tag, ...meta }),
});

module.exports = logger;
