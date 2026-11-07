import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBlogPostBySlug, getRelatedPosts } from '../data/blogData.js';
import styles from './BlogPages.module.css';

export function BlogDetailPage() {
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);
  const [copied, setCopied] = useState(false);

  if (!post) {
    return (
      <div className={styles.articleContainer} style={{ textAlign: 'center', padding: '6rem 1rem' }}>
        <h1 className={styles.articleTitle}>Story Not Found</h1>
        <p className={styles.articleSubtitle}>
          The editorial article you are seeking may have been archived or moved.
        </p>
        <Link to="/blog" className={styles.rentTheLookBtn} style={{ marginTop: '1.5rem' }}>
          ← Return to The Journal
        </Link>
      </div>
    );
  }

  const relatedPosts = getRelatedPosts(post.slug, 2);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.subtitle,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Ignored
    }
  }

  const destinationListingUrl = post.recommendedOccasion === 'WeddingGuest'
    ? '/listings?occasion=WeddingGuest'
    : post.recommendedOccasion === 'Lend'
    ? '/lend'
    : '/listings?rental=true';

  return (
    <div className={styles.articlePage}>
      <article className={styles.articleContainer}>
      {/* ── Breadcrumb Navigation ── */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/" className={styles.breadcrumbLink}>Home</Link>
        <span className={styles.breadcrumbSeparator}>›</span>
        <Link to="/blog" className={styles.breadcrumbLink}>The Journal</Link>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span>{post.category}</span>
      </nav>

      {/* ── Article Header ── */}
      <header className={styles.articleHeader}>
        <div className={styles.articleCategoryBadge}>{post.category}</div>
        <h1 className={styles.articleTitle}>{post.title}</h1>
        <p className={styles.articleSubtitle}>{post.subtitle}</p>

        <div className={styles.authorCard}>
          <div className={styles.authorAvatar} aria-hidden="true">
            {post.author.avatar}
          </div>
          <div className={styles.authorInfo}>
            <span className={styles.authorFullName}>{post.author.name}</span>
            <span className={styles.authorRoleText}>{post.author.role}</span>
          </div>
          <div className={styles.articleDateMeta}>
            <div>{post.date}</div>
            <div>{post.readTime}</div>
          </div>
        </div>
      </header>

      {/* ── Editorial Cover Image ── */}
      <div className={styles.articleCoverWrapper}>
        <img
          src={post.coverImage}
          alt={post.title}
          className={styles.articleCover}
        />
      </div>

      {/* ── Article Body Content ── */}
      <div className={styles.articleBody}>
        {post.sections.map((section, idx) => (
          <section key={idx} className={styles.articleSection}>
            <h2 className={styles.sectionHeading}>{section.heading}</h2>
            {section.content.map((para, pIdx) => (
              <p key={pIdx} className={styles.paragraph}>{para}</p>
            ))}
          </section>
        ))}

        {/* ── Key Takeaways Box ── */}
        {post.keyTakeaways && post.keyTakeaways.length > 0 && (
          <aside className={styles.takeawaysBox} aria-label="Key Takeaways">
            <h3 className={styles.takeawaysTitle}>
              <span>✦</span>
              <span>Editorial Key Takeaways</span>
            </h3>
            <ul className={styles.takeawaysList}>
              {post.keyTakeaways.map((item, kIdx) => (
                <li key={kIdx}>{item}</li>
              ))}
            </ul>
          </aside>
        )}

        {/* ── Rent The Look Callout ── */}
        <div className={styles.rentTheLookBox}>
          <div>
            <h3 className={styles.rentTheLookTitle}>Curated for This Story</h3>
            <p className={styles.rentTheLookDesc}>
              Discover designer runway pieces, lehengas, and gowns featured in our styling guides—available for 4 or 8-day rentals with zero dry cleaning required.
            </p>
          </div>
          <Link to={destinationListingUrl} className={styles.rentTheLookBtn}>
            Explore Collection →
          </Link>
        </div>
      </div>

      {/* ── Social Share & Back Link Bar ── */}
      <div className={styles.articleFooterBar}>
        <Link to="/blog" className={styles.backToJournalLink}>
          ← Back to All Stories
        </Link>
        <button
          type="button"
          onClick={handleShare}
          className={styles.shareBtn}
          aria-label="Share article link"
        >
          <span>✦</span>
          <span>{copied ? 'Link Copied to Clipboard!' : 'Share Story'}</span>
        </button>
      </div>

      {/* ── Related Stories Section ── */}
      {relatedPosts.length > 0 && (
        <section className={styles.relatedSection} aria-labelledby="related-stories-heading">
          <h2 id="related-stories-heading" className={styles.relatedHeading}>
            Continue Reading
          </h2>
          <div className={styles.articlesGrid}>
            {relatedPosts.map((related) => (
              <Link
                key={related.id}
                to={`/blog/${related.slug}`}
                className={styles.storyCard}
              >
                <div className={styles.storyCardImageWrapper}>
                  <img
                    src={related.coverImage}
                    alt={related.title}
                    className={styles.storyCardImage}
                    loading="lazy"
                  />
                </div>
                <div className={styles.storyCardBody}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaCategory}>{related.category}</span>
                    <span className={styles.metaDot}>•</span>
                    <span>{related.readTime}</span>
                  </div>
                  <h3 className={styles.storyCardTitle}>{related.title}</h3>
                  <p className={styles.storyCardExcerpt}>{related.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  </div>
  );
}

