import { pool } from '../../src/config/database.js';
import { hashPassword } from '../../src/utils/passwordCrypto.js';

async function seed() {
  console.log('Seeding designer rental showcase data into PostgreSQL...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure luxury curator seller user exists
    const email = 'curator@rentals.luxury';
    const pwdHash = await hashPassword('CuratorPass123!');
    
    let userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;

    if (userRes.rows.length === 0) {
      const newUser = await client.query(
        `INSERT INTO users (email, password_hash, status)
         VALUES ($1, $2, 'active')
         RETURNING id`,
        [email, pwdHash]
      );
      userId = newUser.rows[0].id;

      await client.query(
        `INSERT INTO user_roles (user_id, role_name)
         VALUES ($1, 'customer'), ($1, 'seller')
         ON CONFLICT DO NOTHING`,
        [userId]
      );

      await client.query(
        `INSERT INTO user_profiles (user_id, display_name, phone_number)
         VALUES ($1, 'Luxury Atelier Vault', '+919876543210')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
    } else {
      userId = userRes.rows[0].id;
    }

    // 2. Categories
    const categoriesData = [
      { name: 'Evening Gowns', slug: 'evening-gowns' },
      { name: 'Cocktail & Party', slug: 'cocktail-party' },
      { name: 'Wedding & Festive', slug: 'wedding-festive' },
      { name: 'Vacation & Resort', slug: 'vacation-resort' },
    ];

    const categoryMap = {};
    for (const cat of categoriesData) {
      const res = await client.query(
        `INSERT INTO categories (name, slug, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (slug) DO UPDATE SET is_active = true
         RETURNING id, slug`,
        [cat.name, cat.slug]
      );
      categoryMap[res.rows[0].slug] = res.rows[0].id;
    }

    // 3. Designer Listings
    const listings = [
      {
        title: 'Emerald Cascade Pleated Gown',
        brand: 'BADGLEY MISCHKA',
        size: 'M',
        colour: 'Emerald Green',
        description: 'Stunning emerald floor-sweeping gown designed with pleated crepe, internal corset boning, and flowing silhouette. Perfect for formal weddings and gala celebrations.',
        condition: 'new',
        categorySlug: 'evening-gowns',
        rentalPricePaise: 240000,        // ₹2,400
        salePricePaise: 2200000,         // ₹22,000
        depositPaise: 300000,            // ₹3,000
        replacementValuePaise: 3500000,  // ₹35,000
        city: 'Mumbai',
        imageUrl: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80',
      },
      {
        title: 'Juliette Floral High-Slit Midi Dress',
        brand: 'REFORMATION',
        size: 'S',
        colour: 'Ivory Floral',
        description: 'Effortlessly romantic midi dress with sweetheart neckline, delicate shoulder ties, and breezy side slit. A coveted favorite for summer and daytime wedding celebrations.',
        condition: 'like_new',
        categorySlug: 'cocktail-party',
        rentalPricePaise: 160000,        // ₹1,600
        salePricePaise: 1400000,         // ₹14,000
        depositPaise: 200000,            // ₹2,000
        replacementValuePaise: 2400000,  // ₹24,000
        city: 'Delhi',
        imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
      },
      {
        title: 'Midnight Velvet One-Shoulder Evening Dress',
        brand: 'MARCHESA NOTTE',
        size: 'L',
        colour: 'Midnight Navy',
        description: 'Rich midnight navy velvet column gown featuring architectural one-shoulder drape and subtle waist ruching. Clean, statuesque modern luxury.',
        condition: 'like_new',
        categorySlug: 'evening-gowns',
        rentalPricePaise: 290000,        // ₹2,900
        salePricePaise: 2600000,         // ₹26,000
        depositPaise: 400000,            // ₹4,000
        replacementValuePaise: 3800000,  // ₹38,000
        city: 'Bengaluru',
        imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
      },
      {
        title: 'Silk Organza Embroidered Lehenga Set',
        brand: 'SABYASACHI ARCHIVE',
        size: 'M',
        colour: 'Crimson Gold',
        description: 'Heritage hand-embroidered silk organza lehenga paired with embellished blouse and featherweight dupatta. Curated from archive collection for milestone sangeets.',
        condition: 'new',
        categorySlug: 'wedding-festive',
        rentalPricePaise: 480000,        // ₹4,800
        salePricePaise: 4800000,         // ₹48,000
        depositPaise: 600000,            // ₹6,000
        replacementValuePaise: 6500000,  // ₹65,000
        city: 'Jaipur',
        imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
      },
    ];

    for (const item of listings) {
      const catId = categoryMap[item.categorySlug];

      const listRes = await client.query(
        `INSERT INTO listings (
          owner_type, owner_user_id, title, description, condition,
          size, colour, brand,
          is_rental, is_sale, rental_price_paise, sale_price_paise, deposit_paise, replacement_value_paise,
          listing_status, category_id, city, delivery_available, delivery_radius_km
        )
        VALUES (
          'SELLER', $1, $2, $3, $4,
          $5, $6, $7,
          true, true, $8, $9, $10, $11,
          'active', $12, $13, true, 50
        )
        RETURNING id`,
        [
          userId, item.title, item.description, item.condition,
          item.size, item.colour, item.brand,
          item.rentalPricePaise, item.salePricePaise, item.depositPaise, item.replacementValuePaise,
          catId, item.city
        ]
      );

      const listingId = listRes.rows[0].id;

      // Add image
      await client.query(
        `INSERT INTO listing_images (listing_id, object_key, mime_type, size_bytes, is_primary)
         VALUES ($1, $2, 'image/jpeg', 245000, true)`,
        [listingId, item.imageUrl]
      );

      // Add available inventory units (2 units per dress so backup sizing is possible)
      await client.query(
        `INSERT INTO inventory_items (listing_id, owner_type, owner_user_id, operational_status)
         VALUES ($1, 'SELLER', $2, 'AVAILABLE'), ($1, 'SELLER', $2, 'AVAILABLE')`,
        [listingId, userId]
      );
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${listings.length} designer rental outfits into PostgreSQL!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
