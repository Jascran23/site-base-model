import { env } from './config/env.js';
import { createApp } from './app.js';

const app = await createApp();
app.listen(env.API_PORT, () => {
  console.log(`API + site SSR "${env.PROJECT_NAME}" em http://localhost:${env.API_PORT}`);
});
