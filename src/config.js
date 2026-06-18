import fs from 'fs';
import path from 'path';

const configDir = 'config';
const defaultConfigPath = path.join(configDir, 'default.json');
const configPath = process.env.CONFIG_PATH || defaultConfigPath;

let config = {
  admin: false,
  pollInterval: 600000,
  logLevel: 'info'
};

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      config = { ...config, ...JSON.parse(data) };
      console.log('Config loaded:', config);
    } else {
      console.log('Config file not found, using defaults:', config);
    }
  } catch (e) {
    console.error('Failed to load config:', e.message);
  }
}

loadConfig();

// 环境变量覆盖（优先级高于文件）
if (process.env.PIN) config.pin = process.env.PIN;
if (process.env.TOKEN_EXPIRE_MINUTES) config.tokenExpireMinutes = parseInt(process.env.TOKEN_EXPIRE_MINUTES, 10);
if (process.env.ADMIN) config.admin = process.env.ADMIN === 'true';
if (process.env.LOG_LEVEL) config.logLevel = process.env.LOG_LEVEL;
if (process.env.RESET_PASSWORD) config.resetPassword = process.env.RESET_PASSWORD;

if (fs.existsSync(configPath)) {
  fs.watchFile(configPath, { interval: 1000 }, () => {
    console.log('Config file changed, reloading...');
    loadConfig();
  });
}

export function getConfig() {
  return config;
}
