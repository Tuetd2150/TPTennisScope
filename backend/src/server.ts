import { app } from './app';
import { env } from './config/env';
import { initScheduler } from './jobs/scheduler';

const server = app.listen(env.PORT, () => {
  console.log(`🎾 TennisScope API running on port ${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Frontend origin: ${env.FRONTEND_ORIGIN}`);
  console.log(`   API configured: ${!!env.RAPIDAPI_KEY}`);
  
  if (env.NODE_ENV !== 'test') {
    initScheduler();
  }
});

export { server };
