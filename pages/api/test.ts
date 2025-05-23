import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Test API endpoint called:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
  });

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    environment: process.env.NODE_ENV,
    vercel: process.env.VERCEL ? 'true' : 'false',
  });
} 