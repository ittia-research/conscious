// src/lib/server/logger.ts
import pino from 'pino';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private'; // Or use $env/static/private

// Determine log level from environment variable or default
// Levels: 'fatal', 'error', 'warn', 'info', 'debug', 'trace'
// Default to 'info' in production, 'debug' in development
const logLevel = env.LOG_LEVEL || (dev ? 'debug' : 'info');

// Base logger options
const options: pino.LoggerOptions = {
    level: logLevel,
};

// Use pino-pretty only in development for readable logs
if (dev) {
    options.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard', // Or 'SYS:yyyy-mm-dd HH:MM:ss'
            ignore: 'pid,hostname', // Optional: exclude default fields
        },
    };
} else {
    // Production options (standard JSON output)
    // options.timestamp = () => `,"time":"${new Date().toISOString()}"`; // Example custom timestamp
}

// Create and export the logger instance
export const logger = pino(options);

// Ensure this module isn't accidentally imported into client-side code
if (typeof window !== 'undefined') {
    console.warn(
        'Server logger module (`src/lib/server/logger.ts`) imported on the client. This should be avoided.' +
        ' Ensure imports only happen in `*.server.ts` files or guarded server-side blocks.'
    );
}