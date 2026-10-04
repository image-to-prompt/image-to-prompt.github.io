/**
 * Image to Prompt API - Docker/Node.js Version
 * Rate limit: 3 requests per IP per day (no registration required)
 * Uses OpenAI GPT-4 Vision or compatible API
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limit configuration
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 3;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 86400; // 24 hours

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map();

// Cleanup old entries periodically
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (validTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'), false);
    }
  }
});

/**
 * Get client IP from request
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

/**
 * Check rate limit for an IP
 */
function checkRateLimit(ip) {
  const key = `rate_limit:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const data = rateLimitStore.get(key);

  if (!data || now > data.resetAt) {
    return { allowed: true, remaining: RATE_LIMIT, resetIn: 0 };
  }

  const remaining = Math.max(0, RATE_LIMIT - data.count);
  const resetIn = data.resetAt - now;

  return { allowed: remaining > 0, remaining, resetIn };
}

/**
 * Increment rate limit counter
 */
function incrementRateLimit(ip) {
  const key = `rate_limit:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const data = rateLimitStore.get(key);

  if (!data || now > data.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    });
  } else {
    data.count += 1;
    rateLimitStore.set(key, data);
  }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'image-to-prompt-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Main conversion endpoint
 */
app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided',
        message: 'Please upload an image file'
      });
    }

    // Get client IP and check rate limit
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have reached the limit of ${RATE_LIMIT} conversions per day. Please try again tomorrow.`,
        limit: RATE_LIMIT,
        remaining: 0,
        resetIn: rateLimitResult.resetIn
      });
    }

    // Convert image to base64
    const base64Image = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    // Generate prompt using OpenAI Vision
    const prompt = await generatePrompt(dataUrl);

    // Increment rate limit
    incrementRateLimit(clientIP);

    // Return result
    res.json({
      success: true,
      prompt: prompt,
      model: process.env.MODEL || 'gpt-4o-mini',
      remaining: rateLimitResult.remaining - 1,
      limit: RATE_LIMIT
    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({
      error: 'Failed to generate prompt',
      message: error.message
    });
  }
});

/**
 * Generate prompt from image using OpenAI Vision
 */
async function generatePrompt(imageDataUrl) {
  const systemPrompt = `You are an expert at describing images for AI image generation.
Analyze the image and create a detailed, structured prompt that can be used with Midjourney, Stable Diffusion, or DALL-E.

Include these elements in your description:
- Main subject and composition
- Art style and medium (photography, digital art, painting, etc.)
- Color palette and lighting
- Mood and atmosphere
- Technical details (camera angle, lens, depth of field if applicable)
- Quality modifiers (8k, highly detailed, masterpiece, etc.)

Format the prompt as a single paragraph without explanations. Make it ready to copy and use directly.`;

  const response = await openai.chat.completions.create({
    model: process.env.MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: 'Describe this image in detail as an AI generation prompt.'
          }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.7
  });

  return response.choices[0].message.content.trim();
}

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 10MB'
      });
    }
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Image to Prompt API running on port ${PORT}`);
  console.log(`📊 Rate limit: ${RATE_LIMIT} requests per IP per ${RATE_LIMIT_WINDOW} seconds`);
  console.log(`🤖 Model: ${process.env.MODEL || 'gpt-4o-mini'}`);
});
