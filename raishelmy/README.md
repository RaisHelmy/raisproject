# Rais Helmy - Professional Portfolio

A modern, responsive portfolio website showcasing end-to-end software engineering expertise across enterprise, government, and fintech sectors. Includes an integrated personal blog powered by Cloudflare D1 (SQLite) and R2 storage.

## Quick Start

### Prerequisites
- Node.js (v14 or higher) or Bun
- Cloudflare Account (for production deployment)

### Running the Server

```bash
# Using Bun (recommended)
bun run dev

# Using Node.js
npm start
```

The server will start at `http://localhost:3000`

### Accessing the Blog

- **Blog Listing**: http://localhost:3000/blog
- **Admin Dashboard**: http://localhost:3000/blog/admin (Token: `dev-token` for development)

## Project Structure

```
.
├── public/
│   └── blog/                            # Blog pages and admin interface
│       ├── index.html                   # Blog listing page
│       ├── post.html                    # Individual post view
│       └── admin.html                   # Admin dashboard
├── api/
│   ├── db.js                            # Database utilities (D1)
│   ├── auth.js                          # Authentication middleware
│   └── routes.js                        # API route handlers
├── functions/                           # Cloudflare Pages Functions
│   └── api/blog/[[route]].js           # Blog API endpoint
├── index.html                           # Main portfolio page
├── server.js                            # Node.js development server
├── wrangler.toml                        # Cloudflare configuration
├── BLOG_SETUP.md                        # Blog setup guide
├── package.json                         # Project dependencies
└── README.md                            # This file
```

## Features

### Portfolio
- **End-to-End Infrastructure**: Complete server to deployment solutions
- **Enterprise Experience**: Work with 10+ major companies (SPR, PDRM, DAHUA, WEASTAR MITEL, HUAWEI, TNB, RISDA, KOPERASI, Bayarzakat, Etiqa)
- **Mobile-Responsive Design**: Hamburger menu for screens under 750px
- **Sticky Navigation**: Smooth header transitions on scroll
- **Dynamic Experience Counter**: Auto-calculating years since January 2020

### Blog System
- **Create & Manage Posts**: Simple admin dashboard at `/blog/admin`
- **Image Uploads**: Direct upload to Cloudflare R2 storage
- **SQLite Database**: Powered by Cloudflare D1 for reliable data storage
- **Security**: Token-based authentication for admin access
- **Public Blog**: Clean, accessible blog listing and post pages
- **HTML Content Support**: Full HTML formatting for rich blog posts

## Installation & Deployment

### Local Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Create a sample post
chmod +x scripts/create-sample-post.sh
./scripts/create-sample-post.sh
```

### Production Deployment

For Cloudflare Pages + D1 + R2 setup, see [BLOG_SETUP.md](BLOG_SETUP.md) for detailed instructions.

```bash
# Build for production
bun run build

# Deploy preview
bun run deploy

# Deploy to production
bun run deploy:prod
```

## Configuration

### Environment Variables

For production, set these environment variables in Cloudflare:

```env
BLOG_ADMIN_TOKEN=your-secure-token-here
BLOG_DOMAIN=yourdomain.com
```

For local development, default is `dev-token`.

## Blog Administration

1. Visit `/blog/admin`
2. Enter your admin token
3. Create posts with:
   - Title and excerpt
   - Full HTML content
   - Featured image (upload or paste URL)
4. View published posts at `/blog`

See [BLOG_SETUP.md](BLOG_SETUP.md) for complete administration guide.

## Important

- Make sure the hero image file `RaisBajuMelayu2026SageGreen.png` is placed in the root directory
- Keep your admin token secure and never commit it to version control
- Update R2 domain in `wrangler.toml` if using custom domain

## Contact

- Email: contact@raishelmy.dev
- Portfolio: http://localhost:3000 (when running locally)
- Blog: http://localhost:3000/blog

## License

MIT
