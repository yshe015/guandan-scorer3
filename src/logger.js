import pino from 'pino';
import fs from 'fs';
import { getConfig } from './config.js';

const getLogLevel = () => {
  const config = getConfig();
  return config.logLevel?.toLowerCase() || 'info';
};

const logLevelPriority = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level) {
  const currentLevel = getLogLevel();
  return logLevelPriority[level] >= logLevelPriority[currentLevel];
}

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function createTimestamp() {
  const now = new Date();
  const options = { 
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value;
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
}

const appLogFile = fs.createWriteStream(`${logDir}/app.log`, { flags: 'a' });
const errorLogFile = fs.createWriteStream(`${logDir}/error.log`, { flags: 'a' });

function formatLog(levelName, obj) {
  const ts = createTimestamp();
  const logObj = { timestamp: ts, level: levelName, ...obj };
  return `${JSON.stringify(logObj)}\n`;
}

const logger = {
  debug: (obj, msg) => {
    if (shouldLog('debug')) {
      appLogFile.write(formatLog('debug', typeof obj === 'object' ? { ...obj, msg } : { msg: obj }));
    }
  },
  info: (obj, msg) => {
    if (shouldLog('info')) {
      appLogFile.write(formatLog('info', typeof obj === 'object' ? { ...obj, msg } : { msg: obj }));
    }
  },
  warn: (obj, msg) => {
    if (shouldLog('warn')) {
      appLogFile.write(formatLog('warn', typeof obj === 'object' ? { ...obj, msg } : { msg: obj }));
    }
  },
  error: (obj, msg) => {
    if (shouldLog('error')) {
      errorLogFile.write(formatLog('error', typeof obj === 'object' ? { ...obj, msg } : { msg: obj }));
    }
  }
};

export default logger;
