import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  getAllBlogPosts,
  getBlogPostBySlug,
  getRelatedPosts,
  getBlogPostsByCategory,
} from '../src/features/blog/data/blogData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendSrcDir = path.resolve(__dirname, '../src');

test('The Exchange Journal & Blog Feature Verification', async (t) => {
  await t.test('Categories list defines core editorial pillars', () => {
    assert.ok(BLOG_CATEGORIES.includes('All Stories'));
    assert.ok(BLOG_CATEGORIES.includes('Style Guides'));
    assert.ok(BLOG_CATEGORIES.includes('Sustainability'));
    assert.ok(BLOG_CATEGORIES.includes('Lender Stories'));
    assert.ok(BLOG_CATEGORIES.includes('Craft & Care'));
  });

  await t.test('All blog posts adhere to strict content schema', () => {
    const posts = getAllBlogPosts();
    assert.ok(posts.length >= 4, 'Should contain at least 4 curated editorial stories');

    for (const post of posts) {
      assert.ok(post.id, 'Post must have an id');
      assert.ok(post.slug, 'Post must have a slug');
      assert.ok(post.title && post.title.length > 10, 'Post title must be substantive');
      assert.ok(post.subtitle, 'Post must have a subtitle');
      assert.ok(post.category, 'Post must have a category');
      assert.ok(post.author && post.author.name, 'Post must have an author with a name');
      assert.ok(post.date, 'Post must have a publication date');
      assert.ok(post.readTime, 'Post must have a reading time estimate');
      assert.ok(post.coverImage, 'Post must specify a cover image');
      assert.ok(post.excerpt && post.excerpt.length > 30, 'Post excerpt must provide context');
      assert.ok(Array.isArray(post.sections) && post.sections.length >= 2, 'Post must contain multiple sections');
      assert.ok(Array.isArray(post.keyTakeaways) && post.keyTakeaways.length >= 2, 'Post must provide key takeaways');
    }
  });

  await t.test('getBlogPostBySlug retrieves articles accurately and case-insensitively', () => {
    const weddingPost = getBlogPostBySlug('wedding-guest-couture-guide-2026');
    assert.ok(weddingPost);
    assert.equal(weddingPost.category, 'Style Guides');

    // Case-insensitivity
    const upperLookup = getBlogPostBySlug('WEDDING-GUEST-COUTURE-GUIDE-2026');
    assert.ok(upperLookup);
    assert.equal(upperLookup.id, weddingPost.id);

    // Graceful fallback for non-existent slug
    const missing = getBlogPostBySlug('non-existent-luxury-post-slug');
    assert.equal(missing, null);
    assert.equal(getBlogPostBySlug(null), null);
    assert.equal(getBlogPostBySlug(''), null);
  });

  await t.test('getRelatedPosts returns sibling stories excluding the current post', () => {
    const currentSlug = 'wedding-guest-couture-guide-2026';
    const related = getRelatedPosts(currentSlug, 2);
    assert.equal(related.length, 2);
    assert.ok(related.every((p) => p.slug !== currentSlug));
  });

  await t.test('getBlogPostsByCategory filters accurately', () => {
    const all = getBlogPostsByCategory('All Stories');
    assert.equal(all.length, BLOG_POSTS.length);

    const sustainabilityPosts = getBlogPostsByCategory('Sustainability');
    assert.ok(sustainabilityPosts.length >= 1);
    assert.ok(sustainabilityPosts.every((p) => p.category === 'Sustainability'));

    const emptyCategory = getBlogPostsByCategory('NonExistentCategory');
    assert.equal(emptyCategory.length, 0);
  });

  await t.test('Router configuration includes /blog and /blog/:slug routes', () => {
    const routerCode = fs.readFileSync(path.join(frontendSrcDir, 'app/router.jsx'), 'utf8');
    assert.ok(routerCode.includes("path: 'blog'"), 'router.jsx must define blog index route');
    assert.ok(routerCode.includes("path: 'blog/:slug'"), 'router.jsx must define blog detail route');
    assert.ok(routerCode.includes('BlogIndexPage'), 'router.jsx must import BlogIndexPage');
    assert.ok(routerCode.includes('BlogDetailPage'), 'router.jsx must import BlogDetailPage');
  });

  await t.test('AppLayout navigation integrates The Journal in desktop, mobile, and footer', () => {
    const layoutCode = fs.readFileSync(path.join(frontendSrcDir, 'components/layout/AppLayout.jsx'), 'utf8');
    assert.ok(layoutCode.includes('to="/blog"'), 'AppLayout must link to /blog');
    assert.ok(layoutCode.includes('The Journal'), 'AppLayout must present The Journal navigation label');
  });
});

