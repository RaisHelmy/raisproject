# Blog Setup & Administration Guide

## Overview
Your personal blog is now integrated with Cloudflare D1 (SQLite) for posts and R2 for image storage. The blog includes:

- **Public Blog Pages**: `/blog` - List view, `/blog/:slug` - Single post view
- **Admin Dashboard**: `/blog/admin` - Create, edit, and delete posts
- **Image Uploads**: Direct upload to Cloudflare R2 storage
- **Local Development**: Mock database for testing without Cloudflare setup

## Local Development

### Running the Development Server
```bash
bun run dev
# or
npm start
```

The blog will be available at:
- Blog listing: `http://localhost:3000/blog`
- Admin panel: `http://localhost:3000/blog/admin`
- Sample post: Create a post in admin, then visit `http://localhost:3000/blog/sample-post`

### Admin Token (Development)
For local development, the default admin token is: `dev-token`

When you access `/blog/admin`, you'll be prompted to enter this token.

## Production Setup (Cloudflare Pages + D1 + R2)

### Prerequisites
1. Cloudflare account with Pages, D1, and R2 enabled
2. Wrangler CLI installed: `npm install -g @cloudflare/wrangler`

### Step 1: Create Cloudflare Resources

**Create D1 Database:**
```bash
wrangler d1 create rais-blog
```
Copy the database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "rais-blog"
database_id = "YOUR_DATABASE_ID"
```

**Create R2 Bucket:**
```bash
wrangler r2 bucket create rais-blog-images
```

### Step 2: Set Environment Variables
```bash
wrangler secret put BLOG_ADMIN_TOKEN
# Enter your secure admin token when prompted

wrangler secret put BLOG_DOMAIN
# Enter your production domain (e.g., raishelmy.com)
```

### Step 3: Deploy
```bash
bun run deploy:prod
```

## Admin Interface

### Creating a Blog Post
1. Navigate to `/blog/admin`
2. Enter admin token
3. Fill in the post details:
   - **Title**: Post headline
   - **Excerpt**: Short summary for the blog listing
   - **Content**: Full post content (supports HTML)
   - **Featured Image**: Upload or paste image URL
4. Click "Publish Post"

### Content Format
The content field accepts HTML. Example:
```html
<h2>Heading</h2>
<p>Paragraph text here.</p>
<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>
<blockquote>A meaningful quote</blockquote>
<pre><code>code sample</code></pre>
```

### Managing Posts
- **All Posts Tab**: View all published posts
- **Edit**: Click the post and modify, then republish
- **Delete**: Remove a post permanently

## Image Upload

### Local Development
Images are uploaded to R2 (if configured). For local development without R2, you can:
1. Use external image URLs (e.g., Unsplash, Cloudflare Images)
2. Input the URL directly in the "Featured Image URL" field

### Production
Images are automatically uploaded to your R2 bucket and served at:
```
https://blog-images.raishelmy.com/{filename}
```

Update the R2 domain in `wrangler.toml` if different.

## URI Structure

### Public Routes
- `/` - Home (main portfolio)
- `/blog` - Blog listing
- `/blog/:slug` - Individual blog post (e.g., `/blog/my-first-post`)

### Admin Routes
- `/blog/admin` - Admin dashboard (password-protected with token)

### API Routes (for developers)
- `GET /api/blog/posts` - List all posts
- `GET /api/blog/posts/:slug` - Get single post
- `POST /api/blog/posts` - Create post (requires auth)
- `DELETE /api/blog/posts/:id` - Delete post (requires auth)
- `POST /api/blog/upload` - Upload image (requires auth)

All write operations require the `Authorization: Bearer {TOKEN}` header.

## Security

### Admin Token
- Keep your admin token **secret** and **secure**
- Never commit it to version control
- Use strong, randomly generated tokens in production
- Change tokens if compromised

### CORS
Blog API is CORS-enabled for same-origin requests. Adjust CORS settings in `server.js` or Cloudflare Worker function as needed.

## Troubleshooting

### Blog posts not loading
- Ensure D1 database is initialized: `wrangler d1 execute rais-blog --command "SELECT * FROM posts"`
- Check that the admin token is correct

### Images not uploading
- Verify R2 bucket exists and is accessible
- Check R2 domain in `wrangler.toml` is correct
- Ensure BLOG_ADMIN_TOKEN is set in environment

### Local development auth error
- Default token is `dev-token` - ensure you're using this in `/blog/admin`
- Set custom token: `BLOG_ADMIN_TOKEN=your-token npm start`

## Next Steps

1. **Add blog link to portfolio**: The main portfolio (`index.html`) can be updated to link to `/blog`
2. **Styles customization**: Modify CSS in blog HTML files to match portfolio branding
3. **Markdown support**: Extend content parser to support Markdown rendering
4. **Categories/Tags**: Add database fields and filtering by category
5. **Comments**: Integrate a comment system (e.g., Giscus, Disqus)

## File Structure
```
├── public/blog/
│   ├── index.html        # Blog listing page
│   ├── post.html         # Blog post detail view
│   └── admin.html        # Admin dashboard
├── api/
│   ├── db.js            # D1 database utilities
│   ├── auth.js          # Authentication middleware
│   └── routes.js        # API route handlers
├── wrangler.toml        # Cloudflare configuration
└── server.js            # Local development server
```
