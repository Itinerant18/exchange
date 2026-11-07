import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOG_CATEGORIES, getAllBlogPosts, getBlogPostsByCategory } from '../data/blogData.js';
import styles from './BlogPages.module.css';

export function BlogIndexPage() {
  const [activeCategory, setActiveCategory] = useState('All Stories');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const posts = getBlogPostsByCategory(activeCategory);
  const featuredPost = posts.length > 0 ? posts[0] : null;
  const gridPosts = posts.length > 1 ? posts.slice(1) : (activeCategory !== 'All Stories' ? posts : []);

  function handleNewsletterSubmit(e) {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setSubscribed(true);
      setNewsletterEmail('');
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Editorial Hero Showcase ── */}
      <section className={styles.heroSection} aria-labelledby="journal-hero-title">
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>
            <span>✦</span>
            <span>The Exchange Journal</span>
            <span>✦</span>
          </div>
          <h1 id="journal-hero-title" className={styles.heroTitle}>
            Editorial Musings on Circular Couture, Craft &amp; Conscious Luxury
          </h1>
          <p className={styles.heroSubtitle}>
            Expert style guides, behind-the-seams garment preservation insights, sustainability breakdowns, and stories from our nationwide lender collective.
          </p>
        </div>
      </section>

      <div className={styles.container}>
        {/* ── Category Filter Bar ── */}
        <nav className={styles.filterNav} aria-label="Journal Categories">
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={activeCategory === cat ? styles.categoryPillActive : styles.categoryPill}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* ── Featured Editorial Banner ── */}
        {featuredPost && (
          <Link
            to={`/blog/${featuredPost.slug}`}
            className={styles.featuredStoryCard}
            aria-label={`Read featured story: ${featuredPost.title}`}
          >
            <div className={styles.featuredImageWrapper}>
              <span className={styles.featuredBadge}>Featured Story</span>
              <img
                src={featuredPost.coverImage}
                alt={featuredPost.title}
                className={styles.featuredImage}
                loading="eager"
              />
            </div>
            <div className={styles.featuredContent}>
              <div className={styles.metaRow}>
                <span className={styles.metaCategory}>{featuredPost.category}</span>
                <span className={styles.metaDot}>•</span>
                <span>{featuredPost.readTime}</span>
                <span className={styles.metaDot}>•</span>
                <span>{featuredPost.date}</span>
              </div>
              <h2 className={styles.featuredTitle}>{featuredPost.title}</h2>
              <p className={styles.featuredExcerpt}>{featuredPost.excerpt}</p>
              <span className={styles.readMoreBtn}>
                Read Full Story →
              </span>
            </div>
          </Link>
        )}

        {/* ── Editorial Grid ── */}
        {gridPosts.length > 0 && (
          <div className={styles.articlesGrid} role="feed" aria-label="Stories">
            {gridPosts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className={styles.storyCard}
                aria-label={`Read story: ${post.title}`}
              >
                <div className={styles.storyCardImageWrapper}>
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className={styles.storyCardImage}
                    loading="lazy"
                  />
                </div>
                <div className={styles.storyCardBody}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaCategory}>{post.category}</span>
                    <span className={styles.metaDot}>•</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h3 className={styles.storyCardTitle}>{post.title}</h3>
                  <p className={styles.storyCardExcerpt}>{post.excerpt}</p>
                  <div className={styles.storyCardFooter}>
                    <span className={styles.authorName}>{post.author.name}</span>
                    <span>{post.date}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Newsletter Dispatch ── */}
        <section className={styles.newsletterSection} aria-labelledby="newsletter-heading">
          <div className={styles.newsletterEyebrow}>Stay Inspired</div>
          <h2 id="newsletter-heading" className={styles.newsletterTitle}>
            Join The Circular Edit
          </h2>
          <p className={styles.newsletterDesc}>
            Receive our weekly digest of seasonal styling blueprints, newly inducted couture pieces, and invitations to private trunk shows.
          </p>
          {subscribed ? (
            <div className="alert alert-success" style={{ maxWidth: 440, margin: '0 auto' }}>
              ✦ Welcome to The Circular Edit. You are subscribed to our weekly digest.
            </div>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className={styles.newsletterForm}>
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address..."
                className={styles.newsletterInput}
                aria-label="Email address for journal subscription"
              />
              <button type="submit" className={styles.newsletterBtn}>
                Subscribe
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

