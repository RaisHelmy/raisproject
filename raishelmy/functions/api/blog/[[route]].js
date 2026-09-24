// functions/api/blog/[[route]].js
// Cloudflare Pages Functions entry point for blog API

import { handleBlogAPI } from '../../../api/routes.js';

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;

  // Parse the URL to extract the route
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only handle /api/blog/* routes
  if (!pathname.startsWith('/api/blog/')) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    return await handleBlogAPI(request, env);
  } catch (error) {
    console.error('Blog API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
