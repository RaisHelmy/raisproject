#!/bin/bash
# scripts/create-sample-post.sh
# Creates a sample blog post for testing

TOKEN="${BLOG_ADMIN_TOKEN:-dev-token}"
API_URL="${API_URL:-http://localhost:3000}"

echo "Creating sample blog post..."

curl -X POST "$API_URL/api/blog/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Welcome to My Blog",
    "excerpt": "An introduction to my thoughts on building systems and technical leadership.",
    "content": "<h2>Welcome!</h2><p>This is your first blog post. You can write anything you want here using HTML.</p><p>The blog features:</p><ul><li>Fast static generation with Cloudflare</li><li>Image uploads to R2 storage</li><li>SQLite database with D1</li><li>Simple admin interface</li></ul><h2>What's Next?</h2><p>Start writing! Each post can include:</p><ul><li>HTML formatting</li><li>Code snippets</li><li>Custom styling</li><li>Featured images</li></ul>",
    "featured_image": "https://images.unsplash.com/photo-1516321318423-f06f70504646?auto=format&fit=crop&w=1000&h=500"
  }'

echo "\nSample post created! Visit http://localhost:3000/blog to see it."
