/**
 * Exchange24 Editorial & Journal Content Repository
 * Curated articles covering luxury fashion styling, circular sustainability,
 * lender wardrobe monetization, and couture textile care.
 */

export const BLOG_CATEGORIES = [
  'All Stories',
  'Style Guides',
  'Sustainability',
  'Lender Stories',
  'Craft & Care',
];

export const BLOG_POSTS = [
  {
    id: 'post-1',
    slug: 'wedding-guest-couture-guide-2026',
    title: 'The Luxury Wedding Guest Dressing Guide: Decoding Multi-Day Festivities',
    subtitle: 'How to curate distinct designer ensembles for Mehendi, Sangeet, and Reception without wardrobe fatigue or excessive spend.',
    category: 'Style Guides',
    author: {
      name: 'Pooja Malhotra',
      role: 'Head of Editorial Styling',
      avatar: '✦',
    },
    date: 'November 4, 2026',
    readTime: '5 min read',
    coverImage: '/videos/hero-runway-poster.jpg',
    excerpt: 'Indian luxury destination weddings are extravagant multi-day affairs where repeating the same heavy silhouette is not an option. Here is our stylist blueprint for renting standout couture across every ceremony.',
    sections: [
      {
        heading: 'The Modern Wedding Dilemma',
        content: [
          'Between destination celebrations across Rajasthan, Goa, and Europe, contemporary wedding attendees frequently attend three to four distinct functions within a single weekend. Investing ₹1,50,000 to ₹3,50,000 per bespoke outfit leads to crowded wardrobes filled with gowns and lehengas that can never be repeated in the same social circles.',
          'Renting designer couture solves this friction by pairing access to marquee runway collections with effortless logistics. You arrive in a fresh masterpiece for every photo without the long-term storage burden or depreciation.',
        ],
      },
      {
        heading: 'Curating the Three-Day Capsule',
        content: [
          'Day 1: The Sunshine Mehendi & Sundowner. Opt for lightweight tissue organza, breezy pre-draped sarees, or printed silk sharara sets. Keep jewel tones airy—think blush peony, raw marigold, and mint jade—allowing effortless movement while henna cures.',
          'Day 2: The High-Energy Sangeet. Glamour and flexibility are non-negotiable on the dance floor. Mirror-embellished lehengas, midnight obsidian concept sarees, and structured corsets with basting alterations provide breathtaking stage impact while withstanding hours of choreography.',
          'Day 3: The Grand Reception. This is the moment for unapologetic regal grandeur. Rich burgundy velvets, antique zardozi work, and hand-woven Banarasi brocades command reverence. Complement with statement temple jewelry or polki chokers for an unforgettable entrance.',
        ],
      },
      {
        heading: 'The Fit Assurance: Why Backup Sizing Matters',
        content: [
          'One common hesitation when renting high-fashion garments online is fit reliability. Exchange24 eliminates this risk by bundling a complimentary backup size with every rental order. Furthermore, our master tailors utilize reversible basting stitches along side seams, granting a bespoke, custom-tailored silhouette that hugs your proportions while preserving the garment’s original construction.',
        ],
      },
    ],
    keyTakeaways: [
      'Choose breathable tissue silks for afternoon sundowners and mirror-embellished fabrics for Sangeet dance stages.',
      'Embrace deep jewel-tone velvets and zardozi weaves for grand evening receptions.',
      'Take advantage of complimentary backup sizes and reversible basting alterations for flawless fit.',
    ],
    recommendedOccasion: 'WeddingGuest',
  },
  {
    id: 'post-2',
    slug: 'sustainability-impact-circular-couture',
    title: 'The Art of Circular Luxury: Saving 14.2kg CO2e Per Rental',
    subtitle: 'Why renting handcrafted couture is the most elegant climate-conscious choice modern luxury fashion offers.',
    category: 'Sustainability',
    author: {
      name: 'Dr. Ananya Roy',
      role: 'Director of Textile Sustainability',
      avatar: '✦',
    },
    date: 'October 28, 2026',
    readTime: '4 min read',
    coverImage: '/videos/hero-runway-poster.jpg',
    excerpt: 'Every handcrafted bridal lehenga requires upwards of 180 hours of hand embroidery and 2,400 liters of freshwater. By recirculating these heirlooms, we slash lifecycle footprints by up to 86%.',
    sections: [
      {
        heading: 'The Hidden Toll of Occasionwear',
        content: [
          'High fashion has long operated under an unsustainable paradox: garments with the most intricate artistry, rarest fibers, and heaviest carbon footprint are worn the fewest times. Industry data demonstrates that premium occasion wear is worn an average of just 1.3 times before being consigned to permanent closet hibernation.',
          'The cultivation of pure mulberry silk, spinning of metallic zari, and multi-stage dyeing processes demand significant energy and freshwater resources. When a garment is worn only once, the environmental investment per hour of celebration is staggering.',
        ],
      },
      {
        heading: 'The Exponential Math of Circular Wear',
        content: [
          'When a single couture outfit is rented across 10 to 15 milestone events over its verified lifecycle, the environmental footprint per wear plummets dramatically. Our life-cycle assessments indicate that renting an existing designer piece reduces net carbon emissions by an average of 14.2 kg CO2e and saves over 2,100 liters of freshwater compared to purchasing a new garment.',
          'Circular luxury does not ask tastemakers to compromise on prestige or beauty. Instead, it elevates the garment to an enduring work of art that lives through multiple joyous celebrations.',
        ],
      },
      {
        heading: 'Zero Single-Use Logistics & Eco Cleaning',
        content: [
          'Sustainability at Exchange24 extends beyond the rack. Our logistics utilize reinforced, water-repellent courier garment bags that eliminate single-use cardboard boxes and plastic wraps. In tandem, our garment sanitization process replaces petroleum-based solvents with hospital-grade ozone sterilization, using 90% less water while safeguarding delicate vintage embroidery.',
        ],
      },
    ],
    keyTakeaways: [
      'Recirculating couture extends garment utility from 1.3 wears to over 15 celebrated occasions.',
      'Each rental saves approximately 14.2 kg of CO2e and thousands of liters of freshwater.',
      'Eco-friendly ozone sanitization preserves metal threads without toxic perchloroethylene chemical solvents.',
    ],
    recommendedOccasion: 'Rental',
  },
  {
    id: 'post-3',
    slug: 'monetize-designer-wardrobe-lender-guide',
    title: 'Lender Spotlight: How Meera Earned ₹1,45,000 from Her Bridal Trousseau',
    subtitle: 'Transforming high-value occasionwear into passive revenue while retaining permanent ownership and insured protection.',
    category: 'Lender Stories',
    author: {
      name: 'Editorial Team',
      role: 'Exchange24 Curators',
      avatar: '✦',
    },
    date: 'October 19, 2026',
    readTime: '6 min read',
    coverImage: '/videos/hero-runway-poster.jpg',
    excerpt: 'After her destination wedding in Jaipur, Meera realized her ₹3,80,000 designer lehenga would spend years encased in cotton bags. Here is how she monetized it safely with Exchange24.',
    sections: [
      {
        heading: 'From Inactive Closet Asset to Performing Portfolio',
        content: [
          'Most bridal trousseaus represent substantial emotional and financial investments. Yet once the nuptials conclude, these extraordinary pieces remain idle, taking up prime wardrobe space. Meera Verma, a Mumbai-based creative director, faced this exact situation with her ivory raw silk designer bridal lehenga.',
          '“I invested nearly four lakhs in my dream outfit,” explains Meera. “The thought of it collecting dust felt wasteful. When I discovered Exchange24’s lender studio, I realized I could keep full ownership of my heirloom while sharing the joy of wearing it with other brides and guests.”',
        ],
      },
      {
        heading: 'Transparent Economics & Security First',
        content: [
          'Exchange24’s lender model offers industry-leading creator splits: lenders receive 80% of net rental proceeds directly deposited to their verified bank accounts. Over the course of eight festive rentals across wedding season, Meera’s lehenga generated ₹1,45,000 in net revenue.',
          'Crucially, Exchange24 handles end-to-end logistics. Our team manages door-to-door courier pickups, mandatory identity verification (KYC), security deposit holds, and white-glove ozone sterilization between bookings. Lenders never have to coordinate with borrowers directly or worry about cleaning fees.',
        ],
      },
      {
        heading: 'How to Prepare Your Pieces for Lending',
        content: [
          'To maximize your earnings, choose pieces from recognized couture houses, contemporary bridal designers, or artisanal handloom ateliers. Ensure original tags or authenticity invoices are accessible, and list items at least four weeks prior to peak festive and wedding windows (October through March) to capture maximum advance bookings.',
        ],
      },
    ],
    keyTakeaways: [
      'Lenders retain 80% of net rental revenue with automated payouts deposited directly after each rental.',
      'Comprehensive KYC verification, refundable security deposits, and transit insurance safeguard your investment.',
      'Exchange24 coordinates all logistics, dry cleaning, and return inspections automatically.',
    ],
    recommendedOccasion: 'Lend',
  },
  {
    id: 'post-4',
    slug: 'care-preservation-heritage-zari-silk',
    title: 'Behind the Seams: The Science of Ozone Sanitization and Heritage Zari Care',
    subtitle: 'How hospital-grade ozone sterilization preserves delicate antique metal threads and silk weaves without chemical degradation.',
    category: 'Craft & Care',
    author: {
      name: 'Vikram Sengupta',
      role: 'Master Textile Conservator',
      avatar: '✦',
    },
    date: 'October 12, 2026',
    readTime: '4 min read',
    coverImage: '/videos/hero-runway-poster.jpg',
    excerpt: 'Delicate real silver and gold zari thread cannot tolerate harsh perchloroethylene chemical dry cleaning. Discover our 7-stage eco-sanitization and basting protocols.',
    sections: [
      {
        heading: 'The Fragility of Metal Thread Embroidery',
        content: [
          'Authentic zardozi and gota patti craftsmanship involve wrapping microscopic strips of gold or silver alloy around a silk core filament. When exposed to traditional commercial dry cleaning reagents such as perchloroethylene (perc), the metal tarnishes, while high thermal pressing causes the delicate silk foundation to turn brittle.',
          'Preserving the luster and integrity of heritage textile heirlooms across dozens of rental cycles requires a non-thermal, zero-solvent sanitization methodology inspired by museum textile conservation.',
        ],
      },
      {
        heading: 'The 7-Stage Ozone Sanitization Cycle',
        content: [
          'At Exchange24, every garment returning from a rental enters our negative-pressure ozone sanitization chambers. Pure oxygen is transformed into ozone gas (O3), an organic oxidizing agent that penetrates fabric pores at ambient room temperature. In just 25 minutes, ozone eradicates 99.9% of bacteria, viruses, and odors without wetting the fibers or stressing the embroidery.',
          'Following sanitization, garments are inspected under calibrated 5000K daylight lamps for micro-snags, treated with spot-specific botanical solutions, and finished with neutral pH ultrasonic steam to restore the natural hand-feel of the silk.',
        ],
      },
      {
        heading: 'Reversible Basting Alterations',
        content: [
          'To provide a flawless fit without damaging the fabric, our master tailors use loose chain basting stitches. These stitches adjust chest, waist, and blouse contours by up to two inches without ever cutting excess cloth. Upon return, the basting threads are carefully removed, returning the garment to its pristine baseline state ready for its next borrower.',
        ],
      },
    ],
    keyTakeaways: [
      'Negative-pressure ozone gas sanitizes fibers at ambient temperature without chemical discoloration or liquid saturation.',
      'Calibrated daylight inspection catches micro-snags before they can compromise structural weave integrity.',
      'Reversible basting allows bespoke customization without cutting or altering original heirloom fabrics.',
    ],
    recommendedOccasion: 'Care',
  },
];

export function getAllBlogPosts() {
  return BLOG_POSTS;
}

export function getBlogPostBySlug(slug) {
  if (!slug) return null;
  return BLOG_POSTS.find((post) => post.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export function getRelatedPosts(currentSlug, limit = 2) {
  return BLOG_POSTS.filter((post) => post.slug !== currentSlug).slice(0, limit);
}

export function getBlogPostsByCategory(category) {
  if (!category || category === 'All Stories') {
    return BLOG_POSTS;
  }
  return BLOG_POSTS.filter((post) => post.category.toLowerCase() === category.toLowerCase());
}
