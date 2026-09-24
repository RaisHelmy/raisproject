const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const hostname = '0.0.0.0';
const port = 3000;

// Mock database (for local development)
let posts = [];
let postIdCounter = 1;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Serve profile config
  if (pathname === '/api/profile') {
    serveFile(path.join(__dirname, 'data/profile.json'), res);
    return;
  }

  // API Routes
  if (pathname.startsWith('/api/blog/')) {
    handleBlogAPI(req, res, pathname, parsedUrl);
    return;
  }

  // Serve sitemap and robots.txt
  if (pathname === '/sitemap.xml') {
    serveFile(path.join(__dirname, 'sitemap.xml'), res);
    return;
  }
  if (pathname === '/robots.txt') {
    serveFile(path.join(__dirname, 'robots.txt'), res);
    return;
  }

  // Serve CV (shared template; ?pos= query param is read client-side)
  if (pathname === '/cv' || pathname === '/cv/') {
    serveFile(path.join(__dirname, 'cv.html'), res);
    return;
  }

  // Serve Cover Letter (shared template; ?pos= query param is read client-side)
  if (pathname === '/coverletter' || pathname === '/coverletter/') {
    serveFile(path.join(__dirname, 'coverletter.html'), res);
    return;
  }

  // Serve Political Web Services brochure
  if (pathname === '/broucherpolitic' || pathname === '/broucherpolitic/') {
    serveFile(path.join(__dirname, 'broucherpolitic.html'), res);
    return;
  }

  // Serve proposal page for Khairul Aming
  if (
    pathname === '/proposal-khairul-aming' ||
    pathname === '/proposal-khairul-aming/' ||
    pathname === '/proposal/khairul-aming' ||
    pathname === '/proposal/khairul-aming/'
  ) {
    serveFile(path.join(__dirname, 'proposal-khairul-aming.html'), res);
    return;
  }

  // Serve MA63 Dashboard
  if (pathname === '/ma63' || pathname === '/ma63/') {
    serveFile(path.join(__dirname, 'ma63_dashboard_mobile.html'), res);
    return;
  }

  // Serve tips pages
  if (pathname === '/tips' || pathname === '/tips/') {
    serveFile(path.join(__dirname, 'tips_slide/index.html'), res);
    return;
  }

  if (pathname.startsWith('/tips/')) {
    const slug = pathname.slice('/tips/'.length);
    const tipFile = path.join(__dirname, 'tips_slide', slug + '.html');
    serveFile(tipFile, res);
    return;
  }

  // Serve tips_slide static assets (CSS, JS, data files)
  if (pathname.startsWith('/tips_slide/')) {
    serveFile(path.join(__dirname, pathname.slice(1)), res);
    return;
  }

  // Serve blog pages
  if (pathname === '/blog' || pathname === '/blog/') {
    serveFile(path.join(__dirname, 'public/blog/index.html'), res);
    return;
  }

  if (pathname.startsWith('/blog/') && pathname !== '/blog/admin') {
    serveFile(path.join(__dirname, 'public/blog/post.html'), res);
    return;
  }

  if (pathname === '/blog/admin') {
    serveFile(path.join(__dirname, 'public/blog/admin.html'), res);
    return;
  }

  // Serve uploaded files
  if (pathname.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, 'public', pathname);
    serveFile(filePath, res);
    return;
  }

  // Default file serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  serveFile(filePath, res);
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath);

  let contentType = 'text/html';
  if (ext === '.css') contentType = 'text/css';
  else if (ext === '.js') contentType = 'application/javascript';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.svg') contentType = 'image/svg+xml';
  else if (ext === '.json') contentType = 'application/json';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html');
      res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(content, 'utf-8');
  });
}

function handleBlogAPI(req, res, pathname, parsedUrl) {
  const method = req.method;
  const adminToken = process.env.BLOG_ADMIN_TOKEN || 'dev-token';
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // GET /api/blog/posts - List all posts
  if (method === 'GET' && pathname === '/api/blog/posts') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ posts: posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) }));
    return;
  }

  // GET /api/blog/posts/:id-or-slug - Get single post
  if (method === 'GET' && pathname.startsWith('/api/blog/posts/')) {
    const identifier = pathname.split('/').pop();
    const isNumeric = /^\d+$/.test(identifier);
    const post = isNumeric
      ? posts.find(p => p.id === parseInt(identifier))
      : posts.find(p => p.slug === identifier);
    
    if (!post) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Post not found' }));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ post }));
    return;
  }

  // Authentication check for write operations
  if (method !== 'GET' && token !== adminToken) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // POST /api/blog/posts - Create new post
  if (method === 'POST' && pathname === '/api/blog/posts') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { title, excerpt, content_url, featured_image } = JSON.parse(body);
        
        if (!title || !excerpt || !content_url || !featured_image) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        const slug = generateSlug(title);
        const newPost = {
          id: postIdCounter++,
          title,
          slug,
          excerpt,
          content_url,
          featured_image,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        posts.push(newPost);

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(newPost));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // PUT /api/blog/posts/:id - Update post
  if (method === 'PUT' && pathname.startsWith('/api/blog/posts/')) {
    const id = parseInt(pathname.split('/').pop());
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { title, excerpt, content_url, featured_image } = JSON.parse(body);
        const postIndex = posts.findIndex(p => p.id === id);

        if (postIndex === -1) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Post not found' }));
          return;
        }

        const existing = posts[postIndex];
        const updatedSlug = title ? generateSlug(title) : existing.slug;
        posts[postIndex] = {
          ...existing,
          title: title || existing.title,
          slug: updatedSlug,
          excerpt: excerpt || existing.excerpt,
          content_url: content_url || existing.content_url,
          featured_image: featured_image || existing.featured_image,
          updated_at: new Date().toISOString()
        };

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ post: posts[postIndex] }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // DELETE /api/blog/posts/:id - Delete post
  if (method === 'DELETE' && pathname.startsWith('/api/blog/posts/')) {
    const id = parseInt(pathname.split('/').pop());
    const postIndex = posts.findIndex(p => p.id === id);

    if (postIndex === -1) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Post not found' }));
      return;
    }

    posts.splice(postIndex, 1);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Post deleted', id }));
    return;
  }

  // POST /api/blog/upload/image - Upload image (saves to disk in dev)
  if (method === 'POST' && pathname === '/api/blog/upload/image') {
    if (token !== adminToken) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        const boundary = contentType.split('boundary=')[1];

        // Parse multipart form data
        if (boundary) {
          const parts = parseMultipart(buffer, boundary);
          const filePart = parts.find(p => p.name === 'file');

          if (filePart) {
            const uploadsDir = path.join(__dirname, 'public', 'uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            const ext = filePart.filename ? path.extname(filePart.filename) : '.jpg';
            const filename = `${Date.now()}${ext}`;
            const filepath = path.join(uploadsDir, filename);
            fs.writeFileSync(filepath, filePart.data);

            const fileUrl = `/uploads/${filename}`;
            res.statusCode = 201;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url: fileUrl, filename, copyable: true }));
            return;
          }
        }

        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'No file found in upload' }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // POST /api/blog/upload/html - Upload HTML (saves to disk in dev)
  if (method === 'POST' && pathname === '/api/blog/upload/html') {
    if (token !== adminToken) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        const boundary = contentType.split('boundary=')[1];

        if (boundary) {
          const parts = parseMultipart(buffer, boundary);
          const filePart = parts.find(p => p.name === 'file');

          if (filePart) {
            const uploadsDir = path.join(__dirname, 'public', 'uploads', 'html');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            const filename = `${Date.now()}.html`;
            const filepath = path.join(uploadsDir, filename);
            fs.writeFileSync(filepath, filePart.data);

            const fileUrl = `/uploads/html/${filename}`;
            res.statusCode = 201;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url: fileUrl, filename }));
            return;
          }
        }

        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'No file found in upload' }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not Found' }));
}

// Parse multipart/form-data
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = 0;

  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuf, start);
    if (boundaryIdx === -1) break;

    const headerStart = boundaryIdx + boundaryBuf.length + 2; // skip \r\n
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(headerStart, headerEnd).toString();
    const dataStart = headerEnd + 4;
    const nextBoundary = buffer.indexOf(boundaryBuf, dataStart);
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2; // trim \r\n before boundary

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch ? filenameMatch[1] : null,
        data: buffer.slice(dataStart, dataEnd)
      });
    }

    start = nextBoundary === -1 ? buffer.length : nextBoundary;
  }

  return parts;
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log(`Blog admin at http://${hostname}:${port}/blog/admin`);
  console.log(`Use BLOG_ADMIN_TOKEN env var to set admin token (default: dev-token)`);
});
