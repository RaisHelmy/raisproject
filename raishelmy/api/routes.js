// api/routes.js - Blog API Routes
import { initDB, getPosts, getPostBySlug, getPostById, createPost, updatePost, deletePost, generateSlug } from './db.js';
import { checkAuth, unauthorizedResponse, errorResponse, successResponse } from './auth.js';

export async function handleBlogAPI(req, env) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  // Initialize database
  const db = await initDB(env);

  // GET /api/blog/posts - List all posts (public)
  if (method === 'GET' && pathname === '/api/blog/posts') {
    try {
      const posts = await getPosts(db);
      return successResponse({ posts });
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // GET /api/blog/posts/:id or :slug - Get single post (public)
  if (method === 'GET' && pathname.startsWith('/api/blog/posts/') && !pathname.endsWith('/api/blog/posts/')) {
    try {
      const identifier = pathname.split('/').pop();
      const isNumeric = /^\d+$/.test(identifier);
      
      let post;
      if (isNumeric) {
        // Fetch by ID
        post = await getPostById(db, parseInt(identifier));
      } else {
        // Fetch by slug
        post = await getPostBySlug(db, identifier);
      }
      
      if (!post) {
        return errorResponse('Post not found', 404);
      }
      return successResponse({ post });
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // POST /api/blog/posts - Create new post (admin only)
  if (method === 'POST' && pathname === '/api/blog/posts') {
    if (!checkAuth(req, env)) {
      return unauthorizedResponse();
    }

    try {
      const { title, excerpt, content_url, featured_image } = await req.json();
      
      if (!title || !excerpt || !content_url || !featured_image) {
        return errorResponse('Missing required fields: title, excerpt, content_url, featured_image');
      }

      const slug = generateSlug(title);
      const result = await createPost(db, { title, slug, excerpt, content_url, featured_image });
      
      return successResponse({ 
        id: result.meta.last_row_id,
        title,
        slug,
        excerpt,
        content_url,
        featured_image
      }, 201);
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // PUT /api/blog/posts/:id - Update post (admin only)
  if (method === 'PUT' && pathname.startsWith('/api/blog/posts/')) {
    if (!checkAuth(req, env)) {
      return unauthorizedResponse();
    }

    try {
      const id = parseInt(pathname.split('/').pop());
      const { title, excerpt, content_url, featured_image } = await req.json();
      
      const existing = await getPostById(db, id);
      if (!existing) {
        return errorResponse('Post not found', 404);
      }

      const slug = title ? generateSlug(title) : existing.slug;
      await updatePost(db, id, {
        title: title || existing.title,
        slug,
        excerpt: excerpt || existing.excerpt,
        content_url: content_url || existing.content_url,
        featured_image: featured_image || existing.featured_image
      });

      return successResponse({ 
        id,
        title: title || existing.title,
        slug,
        excerpt: excerpt || existing.excerpt,
        content_url: content_url || existing.content_url,
        featured_image: featured_image || existing.featured_image
      });
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // DELETE /api/blog/posts/:id - Delete post (admin only)
  if (method === 'DELETE' && pathname.startsWith('/api/blog/posts/')) {
    if (!checkAuth(req, env)) {
      return unauthorizedResponse();
    }

    try {
      const id = parseInt(pathname.split('/').pop());
      const post = await getPostById(db, id);
      
      if (!post) {
        return errorResponse('Post not found', 404);
      }

      await deletePost(db, id);
      return successResponse({ message: 'Post deleted', id });
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // POST /api/blog/upload/image - Upload image to R2 (admin only)
  if (method === 'POST' && pathname === '/api/blog/upload/image') {
    if (!checkAuth(req, env)) {
      return unauthorizedResponse();
    }

    try {
      const formData = await req.formData();
      const file = formData.get('file');
      
      if (!file) {
        return errorResponse('No file provided');
      }

      const filename = `img/${Date.now()}-${file.name}`;
      const arrayBuffer = await file.arrayBuffer();
      
      await env.BLOG_IMAGES.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type
        }
      });

      const url = `https://blog-images.raishelmy.com/${filename}`;
      return successResponse({ 
        url,
        filename,
        copyable: true
      }, 201);
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // POST /api/blog/upload/html - Upload HTML content to R2 (admin only)
  if (method === 'POST' && pathname === '/api/blog/upload/html') {
    if (!checkAuth(req, env)) {
      return unauthorizedResponse();
    }

    try {
      const formData = await req.formData();
      const file = formData.get('file');
      const htmlContent = formData.get('htmlContent');
      
      let html = '';
      let filename = '';

      if (file) {
        html = await file.text();
        filename = `html/${Date.now()}-${file.name}`;
      } else if (htmlContent) {
        html = htmlContent;
        filename = `html/${Date.now()}-content.html`;
      } else {
        return errorResponse('No HTML file or content provided');
      }

      // Upload to R2
      await env.BLOG_IMAGES.put(filename, html, {
        httpMetadata: {
          contentType: 'text/html'
        }
      });

      const url = `https://blog-images.raishelmy.com/${filename}`;
      return successResponse({ 
        url,
        filename
      }, 201);
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  return errorResponse('Not Found', 404);
}
