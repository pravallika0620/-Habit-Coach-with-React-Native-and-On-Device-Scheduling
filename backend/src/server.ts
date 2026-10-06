import { serve } from '@hono/node-server';
import app from './index.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`🚀 Habit Coach Backend running on http://localhost:${info.port}`);
  }
);
