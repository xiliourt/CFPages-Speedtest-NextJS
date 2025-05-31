// File: functions/api/ping.js
// This function handles ping requests for Cloudflare Pages.
// It's accessed via the path /api/ping relative to your site's domain.

// The standard way to define a Cloudflare Pages Function is to export an onRequest
// (or onRequestGet, onRequestPost, etc.) handler.
export async function onRequestGet(context) {
  // context contains request, env, params, waitUntil, next, data
  const { request } = context;

  // Set CORS headers to allow requests from your frontend domain
  // For Cloudflare Pages, it's often the same domain, but good practice.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or specify your frontend domain if different.
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Note: Cloudflare Pages Functions don't automatically handle OPTIONS for you like Workers modules might.
  // If you encounter CORS issues, you might need an onRequestOptions handler or ensure
  // your frontend and functions are on the same origin.
  // For simple GET, this might be okay if on the same origin.

  return new Response('pong', {
    status: 200,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Content-Type': 'text/plain',
    },
  });
}

// Optional: Handle OPTIONS preflight requests explicitly if needed
export async function onRequestOptions(context) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Or specify your frontend domain
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', // Or be more specific
    };
    return new Response(null, { headers: corsHeaders });
}
