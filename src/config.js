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

if (fs.existsSync(configPath)) {
  fs.watchFile(configPath, { interval: 1000 }, () => {
    console.log('Config file changed, reloading...');
    loadConfig();
  });
}

export function getConfig() {
  return config;
}
