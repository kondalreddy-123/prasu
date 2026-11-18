import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Ensure SRV records resolve cleanly on systems where local DNS resolvers drop SRV lookups
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fallback if environment restricts custom DNS servers
}

let memoryServer = null;

export async function connectDB(customUri = null) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || process.env.MONGODB_URI;

  if (uri && process.env.USE_MEMORY_DB !== 'true') {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
        autoIndex: true,
      });
      console.log(`[HealthPass DB] Connected to MongoDB: ${mongoose.connection.host || 'remote'}`);
      return mongoose.connection;
    } catch (remoteErr) {
      if (process.env.NODE_ENV === 'production') {
        throw remoteErr;
      }
      console.warn(`[HealthPass DB] Could not connect to remote MongoDB (${remoteErr.message}).`);
      console.log('[HealthPass DB] Falling back to In-Memory MongoDB for local development and testing...');
    }
  }

  // Never fall back to in-memory database in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production environment.');
  }

  // In test or non-production local development without MONGODB_URI or when remote is unreachable:
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create();
    }
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri, {
      autoIndex: true,
    });
    console.log(`[HealthPass DB] Connected to In-Memory MongoDB for local development/testing: ${memoryUri}`);
    return mongoose.connection;
  } catch (err) {
    console.warn('[HealthPass DB] Could not start In-Memory MongoDB:', err.message);
    throw err;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export function getDBStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    isReady: mongoose.connection.readyState === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
}
