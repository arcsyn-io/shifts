import pino, { type Logger } from 'pino';

export type AppLogger = Logger;

export function createLogger(level = 'info'): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'password',
        '*.password',
        'token',
        '*.token',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
      ],
      censor: '[REDACTED]',
    },
  });
}
