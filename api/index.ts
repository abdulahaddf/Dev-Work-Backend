import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple health check endpoint
if (process.env.NODE_ENV !== 'production') {
  console.log('Loading API handler...');
}

// Lazy load the app to handle module initialization issues
let appInstance: any = null;

async function getApp() {
  if (!appInstance) {
    try {
      const module = await import('../src/app');
      appInstance = module.default;
    } catch (error) {
      console.error('Failed to load app:', error);
      throw error;
    }
  }
  return appInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get Express app
    const app = await getApp();

    // For health checks - return immediately
    if (req.url === '/health' || req.url === '/api/health') {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      });
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return res.status(200).end();
    }

    // Pass to Express app and wait for response
    return new Promise<void>((resolve, reject) => {
      // Set timeout for response
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 25000);

      res.on('finish', () => {
        clearTimeout(timeout);
        resolve();
      });

      res.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });

      try {
        app(req, res);
      } catch (error) {
        clearTimeout(timeout);
        console.error('App execution error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'production' ? undefined : error,
          });
        }
        resolve();
      }
    });
  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to initialize server',
        error: process.env.NODE_ENV === 'production' ? undefined : String(error),
      });
    }
  }
}
