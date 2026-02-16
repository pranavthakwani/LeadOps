import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load .env file
dotenv.config();

// Start PM2 with environment variables
execSync('pm2 start ecosystem.config.cjs', { 
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});
