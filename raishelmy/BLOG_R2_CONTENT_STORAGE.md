# Blog Architecture Updates - R2 Content Storage

## What Changed

Your blog system has been updated to store HTML content in Cloudflare R2 instead of in the database. This provides better scalability and cleaner separation of concerns.

### Key Changes:

#### 1. **Database Schema Update**
- **Before**: Posts stored full HTML content in the `content` field
- **After**: Posts store only a `content_url` that points to an HTML file in R2
- Database now just stores references, not large content

#### 2. **File Storage Strategy**
```
R2 Bucket Structure:
├── img/        → Featured images & post images
│   ├── 1234567890-image.jpg
│   ├── 1234567891-photo.png
│   └── ...
└── html/       → Post content files
    ├── 1234567890-content.html
    ├── 1234567891-content.html
    └── ...
```

#### 3. **Upload Endpoints**
- **POST `/api/blog/upload/image`** - Upload images (returns copiable URL)
- **POST `/api/blog/upload/html`** - Upload HTML content (returns copiable URL)

#### 4. **Admin Interface Changes**
- **Separate Upload Areas**: Distinct sections for HTML and image uploads
- **Copiable Links**: All uploaded files display with:
  - Full URL ready to copy to clipboard
  - "Copy" button for easy clipboard access
  - "Use" button to auto-populate form fields
- **Two-Step Publishing**:
  1. Upload HTML content (get URL)
  2. Upload featured image (get URL)
  3. Fill in title/excerpt
  4. Click "Publish Post"

#### 5. **Post Viewing Flow**
```
User visits /blog/slug
    ↓
Fetch post metadata from D1 (title, date, featured_image, content_url)
    ↓
Fetch content_url from R2
    ↓
Display full post with HTML content
```

## Usage Workflow

### Creating a New Blog Post

1. **Go to Admin Panel**
   - `http://localhost:3000/blog/admin`
   - Enter token: `dev-token`

2. **Upload HTML Content**
   - Click or drag HTML file to "Upload HTML Content" area
   - File is uploaded to R2's `html/` folder
   - URL appears in the list with Copy button
   - Click "Use" button to populate Content URL field
   ```
   ✓ Copiable Link: https://blog-images.raishelmy.com/html/1234567890-content.html
   [Copy]  [Use]
   ```

3. **Upload Featured Image**
   - Click or drag image to "Upload Featured Image" area
   - Image is uploaded to R2's `img/` folder
   - URL appears in the list with Copy button
   - Click "Use" button to populate Featured Image URL field
   ```
   ✓ Copiable Link: https://blog-images.raishelmy.com/img/1234567890-image.jpg
   [Copy]  [Use]
   ```

4. **Fill Post Details**
   - **Title**: Your post headline
   - **Excerpt**: Brief summary for blog listing
   - **Content URL**: (auto-filled from HTML upload)
   - **Featured Image URL**: (auto-filled from image upload)

5. **Publish**
   - Click "Publish Post"
   - Visit `/blog` to see your new post

### Referencing Images in HTML

Since images have copiable URLs, you can easily reference them in your content:

**In your HTML file or content**, use:
```html
<p>Here's a great image:</p>
<img src="https://blog-images.raishelmy.com/img/1234567890-image.jpg" alt="Description">

<p>Another image:</p>
<img src="https://blog-images.raishelmy.com/img/1234567891-photo.png" alt="Photo">
```

Just copy the URL from the upload result and paste into your HTML!

## Database changes

### New D1 Schema
```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,
  content_url TEXT NOT NULL,    -- ← Updated from 'content'
  featured_image TEXT NOT NULL,
  created_at DATETIME,
  updated_at DATETIME
);
```

## API Changes

### POST /api/blog/posts
**Before:**
```json
{
  "title": "My Post",
  "excerpt": "...",
  "content": "<h2>...</h2><p>...</p>",  // ← Was inline
  "featured_image": "https://..."
}
```

**After:**
```json
{
  "title": "My Post",
  "excerpt": "...",
  "content_url": "https://blog-images.raishelmy.com/html/123-content.html",  // ← URL only
  "featured_image": "https://blog-images.raishelmy.com/img/123-image.jpg"
}
```

### New Endpoints

#### POST /api/blog/upload/image
Upload image files to R2
```
Request: multipart/form-data with 'file' field
Response: { url, filename, copyable: true }
```

#### POST /api/blog/upload/html
Upload HTML content to R2
```
Request: multipart/form-data with 'file' field or 'htmlContent'
Response: { url, filename }
```

## Benefits

✅ **Better Performance**
- Small database footprint
- Content served from R2 CDN
- Faster queries

✅ **Easier Content Updates**
- Upload new HTML, update content_url
- No database migration needed
- Easy to roll back versions

✅ **Easy Reference Sharing**
- Copy any URL directly from admin
- Paste into HTML content
- Perfect for linking between posts or adding images

✅ **Cleaner Architecture**
- Database stores metadata only
- R2 stores large files
- Separation of concerns

✅ **User-Friendly**
- Copiable links for all uploads
- One-click "Use" buttons
- Clear feedback on what's uploaded

## Development Mode

For local development (`localhost:3000`), the upload endpoints return mock URLs:
- Images: `https://blog-images.raishelmy.com/img/{timestamp}-{filename}`
- HTML: `https://blog-images.raishelmy.com/html/{timestamp}-content.html`

In production, these are handled by Cloudflare Pages Functions with actual R2 uploads.

## Migration

If you have existing  posts with inline content in the database, they need migration:

1. Extract `post.content` (HTML)
2. Upload to R2 as HTML file
3. Get the URL
4. Update post record: `content_url = <url>` and remove `content` field
5. Rebuild database schema

*This can be done via a migration script if needed.*

## Troubleshooting

### Upload returns `https://blog-images.raishelmy.com/...` but file doesn't exist
- **Development**: This is expected. The mock URLs are for testing the UI.
- **Production**: Ensure R2 bucket is properly configured and Cloudflare Pages Functions are deployed.

### Content not loading on published post
- Check that `content_url` is correct in admin "All Posts" tab
- Verify the URL is accessible (try visiting it in browser)
- Ensure R2 CORS is configured (production setup)

### Can't copy image URLs
- Make sure you uploaded the image first
- Check that "Copy" button appears next to the URL
- Alternatively, manually highlight and copy the URL text

## Next Steps

1. **Test locally** with the new admin interface
2. **Upload some test content** and verify it displays correctly
3. **Deploy to production** once comfortable
4. **Update any existing posts** with new content_url format (if migrating)
