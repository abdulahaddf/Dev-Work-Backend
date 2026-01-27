import app from './app.js';
import prisma from './prisma/client.js';

const PORT = process.env.PORT || 4000;

// Initialize database connection
let dbConnected = false;

async function initializeDatabase() {
  try {
    await prisma.$connect();
    dbConnected = true;
    console.log('✅ Database connected successfully');
  } catch (error) {
    dbConnected = false;
    console.error('❌ Failed to connect to database:', error);
    // Don't throw - let serverless function continue
  }
}

// Initialize on module load
initializeDatabase().catch((err) => {
  console.error('Database initialization error:', err);
});

// Start server for local development
async function main() {
  try {
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 DevWork API Server                                   ║
║                                                           ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(40)}║
║   Port: ${String(PORT).padEnd(47)}║
║   API URL: http://localhost:${String(PORT).padEnd(27)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Only start listening if not in a serverless environment
if (process.env.VERCEL !== '1') {
  main();
}

// Export for serverless
export default app;
