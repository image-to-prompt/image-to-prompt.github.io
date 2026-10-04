/**
 * Image to Prompt API - Cloudflare Workers
 * Uses LLaVA 1.5 7B model (@cf/llava-hf/llava-1.5-7b-hf)
 * Rate limit: 3 requests per IP per day (no registration required)
 */

// Rate limit configuration
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 86400; // 24 hours in seconds

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check endpoint
      if (path === '/api/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'ok',
          service: 'image-to-prompt-api',
          model: '@cf/llava-hf/llava-1.5-7b-hf',
          version: '1.0.0'
        });
      }

      // Country only; do not return or store the visitor's IP.
      if (path === '/api/region' && request.method === 'GET') {
        return new Response(JSON.stringify({ country: request.cf?.country || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' }
        });
      }

      // Main conversion endpoint
      if (path === '/api/convert' && request.method === 'POST') {
        return handleConvert(request, env);
      }

      // 404 for unknown paths
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: 'Internal server error', message: error.message }, 500);
    }
  }
};

/**
 * Handle image to prompt conversion
 */
async function handleConvert(request, env) {
  // Check if AI binding is configured
  if (!env.AI) {
    return jsonResponse({
      error: 'AI not configured',
      message: 'Please bind Workers AI in your Cloudflare dashboard. Go to Workers & Pages > Your Worker > Settings > Bindings > Add > Workers AI'
    }, 500);
  }

  // Get client IP
  const clientIP = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                   'unknown';

  const rateLimitKey = `rate_limit:${clientIP}`;

  // Check rate limit
  const rateLimitResult = await checkRateLimit(env.IMAGE_TO_PROMPT_KV, rateLimitKey);
  if (!rateLimitResult.allowed) {
    return jsonResponse({
      error: 'Rate limit exceeded',
      message: `You have reached the limit of ${RATE_LIMIT} conversions per day. Please try again tomorrow.`,
      limit: RATE_LIMIT,
      remaining: 0,
      resetIn: rateLimitResult.resetIn
    }, 429);
  }

  // Parse multipart form data
  const formData = await request.formData();
  const imageFile = formData.get('image');

  if (!imageFile || !(imageFile instanceof File)) {
    return jsonResponse({ error: 'No image file provided' }, 400);
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(imageFile.type)) {
    return jsonResponse({
      error: 'Invalid file type',
      message: 'Only JPG, PNG, and WebP images are supported'
    }, 400);
  }

  // Validate file size (10MB)
  const maxSize = 10 * 1024 * 1024;
  if (imageFile.size > maxSize) {
    return jsonResponse({
      error: 'File too large',
      message: 'Maximum file size is 10MB'
    }, 400);
  }

  try {
    // Convert image to Uint8Array for LLaVA
    const imageBuffer = await imageFile.arrayBuffer();
    const imageUint8Array = new Uint8Array(imageBuffer);

    // Generate prompt using LLaVA
    const prompt = await generatePromptWithLLaVA(env.AI, imageUint8Array);

    // Increment rate limit counter
    await incrementRateLimit(env.IMAGE_TO_PROMPT_KV, rateLimitKey);

    // Return result
    return jsonResponse({
      success: true,
      prompt: prompt,
      model: '@cf/llava-hf/llava-1.5-7b-hf',
      remaining: rateLimitResult.remaining - 1,
      limit: RATE_LIMIT
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return jsonResponse({
      error: 'Failed to generate prompt',
      message: error.message
    }, 500);
  }
}

/**
 * Generate prompt using LLaVA 1.5 7B
 * Model: @cf/llava-hf/llava-1.5-7b-hf
 */
async function generatePromptWithLLaVA(ai, imageUint8Array) {
  // LLaVA expects prompt as a string with specific formatting for image-to-prompt task
  const promptText = `You are an expert at creating detailed prompts for AI image generators like Midjourney, Stable Diffusion, and DALL-E.

Analyze this image and create a comprehensive prompt that describes:
1. Main subject and composition
2. Art style and medium (photography, digital art, painting, 3D render, etc.)
3. Color palette and lighting conditions
4. Mood, atmosphere, and emotions
5. Technical details (camera angle, lens, depth of field if applicable)
6. Quality modifiers (8k, highly detailed, masterpiece, best quality, etc.)

Format your response as a single, detailed paragraph without explanations. Make it ready to copy and paste directly into an AI image generator.`;

  const input = {
    image: [...imageUint8Array],  // Convert Uint8Array to regular array
    prompt: promptText,
    max_tokens: 512,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 50,
    repetition_penalty: 1.1
  };

  console.log('Calling LLaVA with input:', {
    prompt: promptText.substring(0, 100) + '...',
    imageSize: imageUint8Array.length
  });

  const response = await ai.run('@cf/llava-hf/llava-1.5-7b-hf', input);

  console.log('LLaVA response:', response);

  // LLaVA returns the description in the response
  // The response format is typically: { description: "..." } or just the text
  let result = '';

  if (typeof response === 'string') {
    result = response;
  } else if (response.description) {
    result = response.description;
  } else if (response.response) {
    result = response.response;
  } else {
    // Try to extract text from any field
    result = Object.values(response).find(v => typeof v === 'string') || JSON.stringify(response);
  }

  return result.trim();
}

/**
 * Check rate limit for an IP
 */
async function checkRateLimit(kv, key) {
  if (!kv) {
    // If KV is not available, allow the request
    return { allowed: true, remaining: RATE_LIMIT, resetIn: 0 };
  }

  const data = await kv.get(key, { type: 'json' });

  if (!data) {
    // No record found, allow request
    return { allowed: true, remaining: RATE_LIMIT, resetIn: 0 };
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if window has expired
  if (now > data.resetAt) {
    // Reset the counter
    return { allowed: true, remaining: RATE_LIMIT, resetIn: 0 };
  }

  const remaining = Math.max(0, RATE_LIMIT - data.count);
  const resetIn = data.resetAt - now;

  return {
    allowed: remaining > 0,
    remaining,
    resetIn
  };
}

/**
 * Increment rate limit counter
 */
async function incrementRateLimit(kv, key) {
  if (!kv) return;

  const now = Math.floor(Date.now() / 1000);
  const data = await kv.get(key, { type: 'json' });

  if (!data || now > data.resetAt) {
    // Create new entry
    await kv.put(key, JSON.stringify({
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    }), { expirationTtl: RATE_LIMIT_WINDOW });
  } else {
    // Increment counter
    await kv.put(key, JSON.stringify({
      count: data.count + 1,
      resetAt: data.resetAt
    }), { expirationTtl: RATE_LIMIT_WINDOW });
  }
}

/**
 * Helper: JSON response with CORS
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
