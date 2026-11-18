import { env } from './config/env.js';
import { createApp } from './app.js';

createApp().listen(env.API_PORT, () => {
  console.log(`API "${env.PROJECT_NAME}" em http://localhost:${env.API_PORT}`);
});
