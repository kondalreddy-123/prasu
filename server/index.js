import { app } from './app.js';
import { connectDB, getDBStatus } from './db.js';
import { seedDemoAccounts } from './seed.js';
import dotenv from 'dotenv';
dotenv.config();

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await connectDB();
    await seedDemoAccounts();
    const status = getDBStatus();
    console.log(`[HealthPass Server] Database status: ${status.state}`);

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n==================================================`);
      console.log(` HealthPass Backend API Server Running`);
      console.log(` Port: ${PORT}`);
      console.log(` URL:  http://localhost:${PORT}`);
      console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(` DB:   ${status.state} (${status.host || 'local/in-memory'})`);
      console.log(`==================================================\n`);
    });

    const shutdown = async () => {
      console.log('\n[HealthPass Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[HealthPass Server] Closed HTTP server.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[HealthPass Server] Startup failure:', err.message);
    process.exit(1);
  }
}

startServer();
