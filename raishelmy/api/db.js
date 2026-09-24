// api/db.js - Database utilities
export async function initDB(env) {
  const db = env.DB;
  
  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT NOT NULL,
      content_url TEXT NOT NULL,
      featured_image TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export async function getPosts(db) {
  return db.prepare(`
    SELECT id, title, slug, excerpt, featured_image, created_at
    FROM posts
    ORDER BY created_at DESC
  `).all();
}

export async function getPostBySlug(db, slug) {
  return db.prepare(`
    SELECT id, title, slug, excerpt, content, featured_image, created_at
    FROM posts
    WHERE slug = ?
  `).bind(slug).first();
}

export async function getPostById(db, id) {
  return db.prepare(`
    SELECT id, title, slug, excerpt, content_url, featured_image, created_at, updated_at
    FROM posts
    WHERE id = ?
  `).bind(id).first();
}

export async function createPost(db, { title, slug, excerpt, content_url, featured_image }) {
  return db.prepare(`
    INSERT INTO posts (title, slug, excerpt, content_url, featured_image)
    VALUES (?, ?, ?, ?, ?)
  `).bind(title, slug, excerpt, content_url, featured_image).run();
}

export async function updatePost(db, id, { title, slug, excerpt, content_url, featured_image }) {
  return db.prepare(`
    UPDATE posts
    SET title = ?, slug = ?, excerpt = ?, content_url = ?, featured_image = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(title, slug, excerpt, content_url, featured_image, id).run();
}

export async function deletePost(db, id) {
  return db.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
}

export function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
