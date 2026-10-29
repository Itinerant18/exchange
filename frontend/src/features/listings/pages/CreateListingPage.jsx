import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { categoriesApi } from '../../../api/categoriesApi.js';
import { api } from '../../../api/apiClient.js';
import { FACET_TAXONOMY } from '../../../components/rental/FilterModal.jsx';
import styles from './CreateListingPage.module.css';

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2', '4', '6', '8', '10', '12', '14', '16'];

const SAMPLE_LOOKS = [
  {
    label: 'Emerald Gown',
    title: 'Emerald Cascade Pleated Gown',
    brand: 'BADGLEY MISCHKA',
    colour: 'Emerald Green',
    city: 'Mumbai',
    rentalPriceRupees: '1800',
    depositRupees: '3000',
    replacementValueRupees: '36000',
    salePriceRupees: '18000',
    description: 'Breathtaking floor-length emerald pleated gown with plunging neckline and delicate waistband. Perfect for black tie galas, evening weddings, and red carpet events.',
    media: [
      {
        id: 'sample-em-1',
        url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=900&q=80',
        fileName: 'emerald-gown-front.jpg',
        fileSize: '1.8 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: true,
      },
      {
        id: 'sample-em-2',
        url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=80',
        fileName: 'emerald-gown-silhouette.jpg',
        fileSize: '1.6 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: false,
      },
      {
        id: 'sample-em-3',
        url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80',
        fileName: 'emerald-gown-detail.jpg',
        fileSize: '1.4 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: false,
      },
      {
        id: 'sample-em-video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        fileName: 'emerald-runway-walkthrough.mp4',
        fileSize: '15.2 MB',
        mimeType: 'video/mp4',
        mediaType: 'video',
        isPrimary: false,
      },
    ],
  },
  {
    label: 'Velvet Cocktail Dress',
    title: 'Midnight Velvet Asymmetric Midi',
    brand: 'REFORMATION',
    colour: 'Midnight Navy',
    city: 'Delhi',
    rentalPriceRupees: '1200',
    depositRupees: '2000',
    replacementValueRupees: '24000',
    salePriceRupees: '11500',
    description: 'Luxurious plush velvet cocktail dress with architectural one-shoulder cut and flattering side slit. Highly versatile for cocktail parties and evening galas.',
    media: [
      {
        id: 'sample-mv-1',
        url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=900&q=80',
        fileName: 'midnight-velvet-front.jpg',
        fileSize: '1.9 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: true,
      },
      {
        id: 'sample-mv-2',
        url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=80',
        fileName: 'midnight-velvet-texture.jpg',
        fileSize: '1.5 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: false,
      },
      {
        id: 'sample-mv-video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        fileName: 'velvet-cocktail-motion.mp4',
        fileSize: '14.8 MB',
        mimeType: 'video/mp4',
        mediaType: 'video',
        isPrimary: false,
      },
    ],
  },
  {
    label: 'Festive Lehenga',
    title: 'Zari Embroidered Raw Silk Lehenga',
    brand: 'SABYASACHI',
    colour: 'Burgundy Crimson',
    city: 'Bengaluru',
    rentalPriceRupees: '4500',
    depositRupees: '8000',
    replacementValueRupees: '95000',
    salePriceRupees: '55000',
    description: 'Heritage raw silk lehenga handcrafted with intricate antique zari and sequin embroidery. Includes matching blouse and organza dupatta with scalloped borders.',
    media: [
      {
        id: 'sample-fl-1',
        url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=900&q=80',
        fileName: 'lehenga-heritage-front.jpg',
        fileSize: '2.4 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: true,
      },
      {
        id: 'sample-fl-2',
        url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80',
        fileName: 'lehenga-zari-embroidery.jpg',
        fileSize: '2.1 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: false,
      },
      {
        id: 'sample-fl-video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        fileName: 'lehenga-twirl-motion.mp4',
        fileSize: '18.1 MB',
        mimeType: 'video/mp4',
        mediaType: 'video',
        isPrimary: false,
      },
    ],
  },
  {
    label: 'Resort Silk Slip',
    title: 'Sunset Hammered Silk Maxi Slip',
    brand: 'ZIMMERMANN',
    colour: 'Sunset Gold',
    city: 'Goa',
    rentalPriceRupees: '1500',
    depositRupees: '2500',
    replacementValueRupees: '28000',
    salePriceRupees: '14000',
    description: 'Effortless bias-cut hammered silk maxi slip dress that cascades fluidly. Ideal for destination weddings, luxury vacations, and sunset soirees.',
    media: [
      {
        id: 'sample-ss-1',
        url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',
        fileName: 'sunset-slip-front.jpg',
        fileSize: '1.7 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: true,
      },
      {
        id: 'sample-ss-2',
        url: 'https://images.unsplash.com/photo-1518049362301-94578b941571?auto=format&fit=crop&w=900&q=80',
        fileName: 'sunset-slip-drape.jpg',
        fileSize: '1.6 MB',
        mimeType: 'image/jpeg',
        mediaType: 'image',
        isPrimary: false,
      },
    ],
  },
];

// Organized facet groups for an editorial seller experience
const FACET_GROUPS = [
  {
    id: 'occasion_style',
    title: 'Occasion & Style Persona',
    keys: ['occasion', 'stylePersona', 'seasonality'],
  },
  {
    id: 'silhouette_fit',
    title: 'Silhouette, Cut & Length',
    keys: ['length', 'neckline', 'sleeve', 'maternity'],
  },
  {
    id: 'fabric_detail',
    title: 'Print, Fabric & Embellishment',
    keys: ['print', 'embellishment'],
  },
];

function formatFacetValue(value) {
  if (value === 'VNeck') return 'V-Neck';
  if (value === 'NotMaternity') return 'Standard Fit';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ');
}

export function CreateListingPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [form, setForm] = useState({
    title: '',
    brand: '',
    categoryId: '',
    size: 'M',
    colour: '',
    condition: 'good',
    description: '',
    city: '',
    isRental: true,
    isSale: false,
    rentalPriceRupees: '',
    depositRupees: '',
    replacementValueRupees: '',
    salePriceRupees: '',
    imageUrl: '',
    deliveryAvailable: true,
  });

  // Multi-Media attachment state (multiple photos & videos)
  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url' | 'presets'
  const [mediaItems, setMediaItems] = useState([]);
  const [directUrl, setDirectUrl] = useState('');
  const [directMediaType, setDirectMediaType] = useState('auto'); // 'auto' | 'image' | 'video'
  const [dragActive, setDragActive] = useState(false);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Structured style attributes ({ occasion: [...], length: [...] })
  const [attributes, setAttributes] = useState({});
  const [activeFacetGroup, setActiveFacetGroup] = useState('occasion_style');

  const primaryItem = mediaItems.find((m) => m.isPrimary) || mediaItems[0] || null;

  useEffect(() => {
    setImageLoadError(false);
    if (primaryItem?.url && primaryItem.url !== form.imageUrl) {
      setForm((prev) => ({ ...prev, imageUrl: primaryItem.url }));
    } else if (!primaryItem && form.imageUrl) {
      setForm((prev) => ({ ...prev, imageUrl: '' }));
    }
  }, [primaryItem?.url]);

  function toggleFacetValue(facetKey, value) {
    setAttributes((current) => {
      const values = current[facetKey] ?? [];
      const next = {
        ...current,
        [facetKey]: values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value],
      };
      if (next[facetKey].length === 0) delete next[facetKey];
      return next;
    });
  }

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Fetch active categories on mount
  useEffect(() => {
    categoriesApi.getCategories()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setCategories(list);
        if (list.length > 0) {
          setForm((prev) => ({ ...prev, categoryId: prev.categoryId || list[0].id }));
        }
      })
      .catch(() => setCategories([]))
      .finally(() => setLoadingCategories(false));
  }, []);

  function handleFiles(incomingFiles) {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const files = Array.from(incomingFiles);
    setError('');

    const newItems = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/') || Boolean(file.name.match(/\.(mp4|webm|mov|ogg)$/i));
      const isImage = file.type.startsWith('image/') || Boolean(file.name.match(/\.(png|jpe?g|webp|avif)$/i));

      if (!isImage && !isVideo) {
        setError(`"${file.name}" is not a supported image or video format.`);
        continue;
      }

      if (isImage && file.size > 15 * 1024 * 1024) {
        setError(`Image "${file.name}" exceeds the 15 MB limit.`);
        continue;
      }

      if (isVideo && file.size > 60 * 1024 * 1024) {
        setError(`Video "${file.name}" exceeds the 60 MB limit.`);
        continue;
      }

      const tempId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const previewUrl = URL.createObjectURL(file);

      newItems.push({
        id: tempId,
        file,
        url: previewUrl,
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        mediaType: isVideo ? 'video' : 'image',
        isPrimary: false,
      });
    }

    if (newItems.length > 0) {
      setMediaItems((prev) => {
        const combined = [...prev, ...newItems];
        if (!combined.some((m) => m.isPrimary)) {
          const firstNonVideo = combined.find((m) => m.mediaType !== 'video') || combined[0];
          firstNonVideo.isPrimary = true;
        }
        return [...combined];
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileInputChange(e) {
    handleFiles(e.target.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleAddDirectUrl(e) {
    if (e) e.preventDefault();
    const trimmed = directUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please provide a valid image or video link starting with https://');
      return;
    }

    const isVideo = directMediaType === 'video' || (directMediaType === 'auto' && Boolean(trimmed.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)));
    const tempId = `url-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem = {
      id: tempId,
      file: null,
      url: trimmed,
      fileName: trimmed.split('/').pop()?.split('?')[0] || (isVideo ? 'runway-video.mp4' : 'garment-photo.jpg'),
      fileSize: isVideo ? 'Remote Video' : 'Remote URL',
      mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
      mediaType: isVideo ? 'video' : 'image',
      isPrimary: false,
    };

    setMediaItems((prev) => {
      const combined = [...prev, newItem];
      if (!combined.some((m) => m.isPrimary)) {
        newItem.isPrimary = true;
      }
      return combined;
    });

    setDirectUrl('');
    setError('');
  }

  function handlePresetSelect(preset) {
    const presetMedia = (preset.media || []).map((m) => ({ ...m }));
    setMediaItems(presetMedia);
    setPreviewActiveIndex(0);
    setForm((prev) => ({
      ...prev,
      imageUrl: presetMedia.find((m) => m.isPrimary)?.url || presetMedia[0]?.url || '',
      title: preset.title,
      brand: preset.brand,
      colour: preset.colour || prev.colour,
      city: preset.city || prev.city,
      rentalPriceRupees: preset.rentalPriceRupees || prev.rentalPriceRupees,
      depositRupees: preset.depositRupees || prev.depositRupees,
      replacementValueRupees: preset.replacementValueRupees || prev.replacementValueRupees,
      salePriceRupees: preset.salePriceRupees || prev.salePriceRupees,
      description: preset.description || prev.description,
    }));
  }

  function setPrimaryMedia(id) {
    setMediaItems((prev) =>
      prev.map((item) => ({
        ...item,
        isPrimary: item.id === id,
      }))
    );
  }

  function removeMedia(id) {
    setMediaItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length > 0 && !next.some((m) => m.isPrimary)) {
        const firstNonVideo = next.find((m) => m.mediaType !== 'video') || next[0];
        firstNonVideo.isPrimary = true;
      }
      return next;
    });
  }

  function moveMedia(index, direction) {
    setMediaItems((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.title || form.title.trim().length < 3) {
      setError('Outfit title must be at least 3 characters long.');
      return;
    }

    if (!form.categoryId) {
      setError('Please select a category for this outfit.');
      return;
    }

    if (mediaItems.length === 0) {
      setError('Please attach at least one photograph or runway video of your designer outfit before publishing.');
      return;
    }

    if (!form.isRental && !form.isSale) {
      setError('Please select at least one offer type (Event Rental or Pre-Loved Purchase).');
      return;
    }

    if (form.isRental && (!form.rentalPriceRupees || Number(form.rentalPriceRupees) <= 0)) {
      setError('Please specify a daily rental rate for event rentals.');
      return;
    }

    if (form.isSale && (!form.salePriceRupees || Number(form.salePriceRupees) <= 0)) {
      setError('Please specify a purchase price for pre-loved resale.');
      return;
    }

    setBusy(true);

    try {
      // 1. Upload any local files to obtain permanent URLs
      const uploadedMedia = [];
      for (const item of mediaItems) {
        if (item.file) {
          try {
            const uploadRes = await listingsApi.uploadMediaFile(item.file);
            const uploadedUrl = uploadRes?.data?.url || uploadRes?.url;
            if (uploadedUrl) {
              uploadedMedia.push({
                objectKey: uploadedUrl,
                mimeType: uploadRes?.data?.mimeType || item.mimeType,
                sizeBytes: uploadRes?.data?.sizeBytes || item.file.size,
                isPrimary: item.isPrimary,
                mediaType: item.mediaType,
              });
            }
          } catch (uploadErr) {
            setError(uploadErr.message || `Failed to upload "${item.fileName}". Please try again.`);
            setBusy(false);
            return;
          }
        } else {
          // Already remote or preset URL
          uploadedMedia.push({
            objectKey: item.url,
            mimeType: item.mimeType,
            sizeBytes: item.mediaType === 'video' ? 12000000 : 250000,
            isPrimary: item.isPrimary,
            mediaType: item.mediaType,
          });
        }
      }

      const primaryMedia = uploadedMedia.find((m) => m.isPrimary) || uploadedMedia[0];

      // 2. Build listing payload with integer paise conversion and attached media
      const payload = {
        title: form.title.trim(),
        brand: form.brand.trim() || 'DESIGNER ARCHIVE',
        categoryId: form.categoryId,
        size: form.size,
        colour: form.colour.trim() || null,
        condition: form.condition,
        description: form.description.trim() || null,
        city: form.city.trim() || null,
        isRental: Boolean(form.isRental),
        isSale: Boolean(form.isSale),
        deliveryAvailable: Boolean(form.deliveryAvailable),
        imageUrl: primaryMedia.objectKey,
        imageSizeBytes: primaryMedia.sizeBytes,
        imageMimeType: primaryMedia.mimeType,
        media: uploadedMedia,
        initialInventory: true,
      };

      if (form.isRental) {
        payload.rentalPricePaise = Math.round(Number(form.rentalPriceRupees) * 100);
        payload.depositPaise = Math.round(Number(form.depositRupees || 0) * 100);
      }

      if (form.replacementValueRupees) {
        payload.replacementValuePaise = Math.round(Number(form.replacementValueRupees) * 100);
      }

      if (form.isSale && form.salePriceRupees !== '') {
        payload.salePricePaise = Math.round(Number(form.salePriceRupees) * 100);
      }

      if (Object.keys(attributes).length > 0) {
        payload.attributes = attributes;
      }

      // 3. Create listing row (with attached media items and inventory created atomically)
      const listing = await listingsApi.createListing(payload);

      // 4. Navigate to the newly created listing detail page
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      setError(err.message || 'Failed to publish listing. Please check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  // Calculated estimates for UI feedback
  const fourDaySubtotal = Number(form.rentalPriceRupees || 0) * 4;
  const retailSavingPct = form.replacementValueRupees && fourDaySubtotal > 0
    ? Math.max(0, Math.round(((Number(form.replacementValueRupees) - fourDaySubtotal) / Number(form.replacementValueRupees)) * 100))
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Breadcrumb & Header ── */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/listings">Catalog</Link>
          <span className={styles.divider}>/</span>
          <span className={styles.breadcrumbCurrent}>List an Outfit</span>
        </nav>

        <div className={styles.header}>
          <span className={styles.eyebrow}>CONSIGNMENT & ATELIER PORTAL</span>
          <h1 className={styles.title}>List a Designer Outfit</h1>
          <p className={styles.subtitle}>
            Offer your luxury lehengas, gowns, and occasion wear to verified fashion collective members for event rental or pre-loved purchase.
          </p>
        </div>

        {error && (
          <div className={styles.alertError} role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── 2-Column Layout: Form (Left) & Live Preview (Right) ── */}
        <div className={styles.layoutGrid}>
          {/* ── Form Column ── */}
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {/* Section 1: Garment & Designer Intel */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.stepBadgeRow}>
                  <span className={styles.sectionStep}>STEP 01</span>
                  <span className={styles.stepPill}>Core Details</span>
                </div>
                <h2 className={styles.sectionHeading}>Garment & Designer Details</h2>
                <p className={styles.sectionDesc}>Specify the designer label, silhouette, category, and size.</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="designer-brand" className={styles.label}>
                  Designer / Brand <span className={styles.req}>*</span>
                </label>
                <input
                  id="designer-brand"
                  type="text"
                  placeholder="e.g. Sabyasachi, Reformation, Zimmermann, Anita Dongre"
                  className={styles.input}
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="listing-title" className={styles.label}>
                  Outfit Title <span className={styles.req}>*</span>
                </label>
                <input
                  id="listing-title"
                  type="text"
                  placeholder="e.g. Emerald Cascade Pleated Gown"
                  className={styles.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="category-select" className={styles.label}>
                    Category <span className={styles.req}>*</span>
                  </label>
                  <select
                    id="category-select"
                    className={styles.select}
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    required
                    disabled={loadingCategories}
                  >
                    {categories.length === 0 && (
                      <option value="">{loadingCategories ? 'Loading categories…' : 'Select a category'}</option>
                    )}
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="size-select" className={styles.label}>
                    Size <span className={styles.req}>*</span>
                  </label>
                  <select
                    id="size-select"
                    className={styles.select}
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                  >
                    {STANDARD_SIZES.map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="condition-select" className={styles.label}>
                    Condition <span className={styles.req}>*</span>
                  </label>
                  <select
                    id="condition-select"
                    className={styles.select}
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    <option value="new">New with tags (Never worn)</option>
                    <option value="like_new">Like new (Worn once / Pristine)</option>
                    <option value="good">Good (Gentle wear, flawless)</option>
                    <option value="fair">Fair (Minor signs of wear)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="colour-input" className={styles.label}>
                    Primary Color / Shade
                  </label>
                  <input
                    id="colour-input"
                    type="text"
                    placeholder="e.g. Emerald Green, Midnight Navy, Burgundy"
                    className={styles.input}
                    value={form.colour}
                    onChange={(e) => setForm({ ...form, colour: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description-input" className={styles.label}>
                  Editorial Description & Styling Notes
                </label>
                <textarea
                  id="description-input"
                  className={styles.textarea}
                  rows={4}
                  placeholder="Describe the silhouette, fabric weight, lining, cup fit, recommended heel height, and occasion suitability…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="city-input" className={styles.label}>
                  Garment Location / City <span className={styles.req}>*</span>
                </label>
                <input
                  id="city-input"
                  type="text"
                  placeholder="e.g. Mumbai, Delhi, Bengaluru, Hyderabad"
                  className={styles.input}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Section 2: Style Attributes (Categorized Facet Taxonomy) */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.stepBadgeRow}>
                  <span className={styles.sectionStep}>STEP 02</span>
                  <span className={styles.stepPill}>Discovery Intel</span>
                </div>
                <h2 className={styles.sectionHeading}>Faceted Style Attributes</h2>
                <p className={styles.sectionDesc}>
                  Select descriptive attributes to power the 11D discovery filters for renters.
                </p>
              </div>

              {/* Group Tabs */}
              <div className={styles.groupTabs} role="tablist">
                {FACET_GROUPS.map((grp) => {
                  const activeCountInGrp = grp.keys.reduce(
                    (sum, k) => sum + (attributes[k]?.length || 0),
                    0
                  );
                  const isActive = activeFacetGroup === grp.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`${styles.groupTab} ${isActive ? styles.groupTabActive : ''}`}
                      onClick={() => setActiveFacetGroup(grp.id)}
                    >
                      <span>{grp.title}</span>
                      {activeCountInGrp > 0 && (
                        <span className={styles.groupBadge}>{activeCountInGrp}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Group Content */}
              <div className={styles.groupContent}>
                {FACET_TAXONOMY
                  .filter((facet) => {
                    const currentGrp = FACET_GROUPS.find((g) => g.id === activeFacetGroup);
                    return currentGrp ? currentGrp.keys.includes(facet.key) : true;
                  })
                  .map((facet) => (
                    <div key={facet.key} className={styles.facetRow}>
                      <div className={styles.facetHeader}>
                        <span className={styles.facetLabel}>{facet.label}</span>
                        {(attributes[facet.key]?.length || 0) > 0 && (
                          <span className={styles.facetActiveCount}>
                            {attributes[facet.key].length} selected
                          </span>
                        )}
                      </div>
                      <div className={styles.chipRow}>
                        {facet.values.map((value) => {
                          const isSelected = (attributes[facet.key] ?? []).includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`${styles.chip} ${isSelected ? styles.chipActive : ''}`}
                              onClick={() => toggleFacetValue(facet.key, value)}
                              aria-pressed={isSelected}
                            >
                              {formatFacetValue(value)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Section 3: Multi-Media & Runway Video Gallery */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.stepBadgeRow}>
                  <span className={styles.sectionStep}>STEP 03</span>
                  <span className={styles.stepPill}>Photography & Video</span>
                </div>
                <h2 className={styles.sectionHeading}>Garment Gallery & Runway Clips</h2>
                <p className={styles.sectionDesc}>
                  Upload multiple high-resolution photos and runway video clips. Set your primary cover photo for the catalog.
                </p>
              </div>

              {/* Dedicated 9:16 Vertical Catwalk Runway Video Feature Banner */}
              <div className={styles.runwayVideoFeatureCard}>
                <div className={styles.runwayVideoLeft}>
                  <div className={styles.catwalkIcon}>▶ 9:16</div>
                  <div>
                    <h3 className={styles.runwayVideoTitle}>
                      5–10s Catwalk Runway Video <span className={styles.recommendedBadge}>Recommended (+3.8x Bookings)</span>
                    </h3>
                    <p className={styles.runwayVideoSubtitle}>
                      Record a 5–10 second vertical smartphone video walking toward the camera and twirling to show garment silhouette, train length, and back embroidery.
                    </p>
                  </div>
                </div>
                <div className={styles.runwayVideoActions}>
                  <label className={styles.uploadCatwalkBtn}>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className={styles.hiddenFileInput}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProcessFiles([file]);
                        e.target.value = '';
                      }}
                    />
                    <span>🎥 Upload Vertical Catwalk</span>
                  </label>
                  <button
                    type="button"
                    className={styles.sampleCatwalkBtn}
                    onClick={() => {
                      const videoItem = {
                        id: `catwalk-sample-${Date.now()}`,
                        url: '/videos/hero-runway.mp4',
                        fileName: 'haute-couture-catwalk.mp4',
                        fileSize: '5.1 MB',
                        mimeType: 'video/mp4',
                        mediaType: 'video',
                        isPrimary: false,
                      };
                      setMediaItems((prev) => [...prev.filter((m) => m.mediaType !== 'video'), videoItem]);
                      setForm((prev) => ({
                        ...prev,
                        media: [...(prev.media || []).filter((m) => m.mediaType !== 'video'), videoItem],
                      }));
                    }}
                  >
                    + Use Sample Runway Video
                  </button>
                </div>
              </div>

              {/* Photo Source Mode Selector */}
              <div className={styles.photoModeNav}>
                <button
                  type="button"
                  className={`${styles.photoModeBtn} ${imageMode === 'upload' ? styles.photoModeBtnActive : ''}`}
                  onClick={() => setImageMode('upload')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload Photos & Videos</span>
                </button>

                <button
                  type="button"
                  className={`${styles.photoModeBtn} ${imageMode === 'url' ? styles.photoModeBtnActive : ''}`}
                  onClick={() => setImageMode('url')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>Direct Media Link</span>
                </button>

                <button
                  type="button"
                  className={`${styles.photoModeBtn} ${imageMode === 'presets' ? styles.photoModeBtnActive : ''}`}
                  onClick={() => setImageMode('presets')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Sample Look Presets</span>
                </button>
              </div>

              {/* Mode 1: File Dropzone / Multi-Attachment */}
              {imageMode === 'upload' && (
                <div className={styles.uploadContainer}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
                    className={styles.hiddenFileInput}
                    onChange={handleFileInputChange}
                  />

                  <div
                    className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div className={styles.dropzoneIconWrapper}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="m22 8-6 4 6 4V8Z" />
                        <rect x="2" y="6" width="14" height="12" rx="2" />
                      </svg>
                    </div>
                    <div className={styles.dropzoneText}>
                      <strong className={styles.dropzoneTitle}>Click to browse or drag & drop outfit photos & runway video</strong>
                      <span className={styles.dropzoneHint}>
                        Select multiple files: JPG, PNG, WebP (up to 15 MB) • MP4, WebM, MOV clips (up to 60 MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.chooseFileBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Choose Photos & Videos
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: Direct Media URL */}
              {imageMode === 'url' && (
                <div className={styles.urlInputBlock}>
                  <div className={styles.formGroup}>
                    <label htmlFor="media-url-input" className={styles.label}>
                      Direct Media Link (HTTPS Photo or Video URL)
                    </label>
                    <div className={styles.inputWithIcon}>
                      <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <input
                        id="media-url-input"
                        type="url"
                        className={`${styles.input} ${styles.inputPadded}`}
                        placeholder="https://images.unsplash.com/... or https://.../video.mp4"
                        value={directUrl}
                        onChange={(e) => setDirectUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDirectUrl();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className={styles.urlControlsRow}>
                    <div className={styles.typeSelectorWrapper}>
                      <label className={styles.typeSelectorLabel}>Media Type:</label>
                      <select
                        className={styles.typeSelect}
                        value={directMediaType}
                        onChange={(e) => setDirectMediaType(e.target.value)}
                      >
                        <option value="auto">Auto-Detect Type</option>
                        <option value="image">Garment Photograph</option>
                        <option value="video">Runway Video Clip</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className={styles.addUrlBtn}
                      onClick={handleAddDirectUrl}
                      disabled={!directUrl.trim()}
                    >
                      + Add to Outfit Media
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 3: Quick Sample Look Presets */}
              {imageMode === 'presets' && (
                <div className={styles.presetsWrapper}>
                  <span className={styles.presetsLabel}>Click a preset look for quick testing with photos & runway video:</span>
                  <div className={styles.presetButtons}>
                    {SAMPLE_LOOKS.map((preset) => {
                      const isSelected = mediaItems.some((m) => m.url === preset.media[0]?.url);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          className={`${styles.presetBtn} ${isSelected ? styles.presetBtnActive : ''}`}
                          onClick={() => handlePresetSelect(preset)}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {preset.label} ({preset.media.length} items)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Multi-Media Gallery Grid */}
              {mediaItems.length > 0 && (
                <div className={styles.galleryContainer}>
                  <div className={styles.galleryHeaderRow}>
                    <div className={styles.gallerySummaryBadge}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>
                        Attached Gallery: {mediaItems.filter((m) => m.mediaType !== 'video').length} Photos,{' '}
                        {mediaItems.filter((m) => m.mediaType === 'video').length} Videos
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.addMoreBtn}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      + Add More Media
                    </button>
                  </div>

                  <div className={styles.mediaGrid}>
                    {mediaItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`${styles.mediaCard} ${item.isPrimary ? styles.mediaCardPrimary : ''}`}
                      >
                        <div className={styles.mediaThumbnailWrapper}>
                          {item.mediaType === 'video' ? (
                            <div className={styles.mediaVideoBox}>
                              <video src={item.url} className={styles.mediaThumb} muted preload="metadata" />
                              <span className={styles.videoBadge}>▶ VIDEO CLIP</span>
                            </div>
                          ) : (
                            <img src={item.url} alt={item.fileName} className={styles.mediaThumb} />
                          )}

                          {item.isPrimary && (
                            <span className={styles.coverBadge}>★ COVER PHOTO</span>
                          )}

                          <span className={styles.mediaSizeBadge}>{item.fileSize}</span>
                        </div>

                        <div className={styles.mediaDetails}>
                          <span className={styles.mediaFilename} title={item.fileName}>
                            {item.fileName}
                          </span>

                          <div className={styles.mediaCardActions}>
                            {item.isPrimary ? (
                              <span className={styles.isCoverPill}>Cover Photo ✓</span>
                            ) : (
                              <button
                                type="button"
                                className={styles.makeCoverBtn}
                                onClick={() => setPrimaryMedia(item.id)}
                              >
                                Set Cover
                              </button>
                            )}

                            <div className={styles.orderButtons}>
                              <button
                                type="button"
                                className={styles.orderBtn}
                                onClick={() => moveMedia(idx, -1)}
                                disabled={idx === 0}
                                title="Move left"
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                className={styles.orderBtn}
                                onClick={() => moveMedia(idx, 1)}
                                disabled={idx === mediaItems.length - 1}
                                title="Move right"
                              >
                                →
                              </button>
                            </div>

                            <button
                              type="button"
                              className={styles.removeMediaBtn}
                              onClick={() => removeMedia(item.id)}
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Offer Modes & Financials */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.stepBadgeRow}>
                  <span className={styles.sectionStep}>STEP 04</span>
                  <span className={styles.stepPill}>Monetization</span>
                </div>
                <h2 className={styles.sectionHeading}>Pricing & Rental Terms</h2>
                <p className={styles.sectionDesc}>Select how you wish to monetize your garment.</p>
              </div>

              {/* Segmented Offer Cards */}
              <div className={styles.offerCardsGrid}>
                {/* Rental Offer Card */}
                <div
                  className={`${styles.offerCard} ${form.isRental ? styles.offerCardActive : ''}`}
                  onClick={() => setForm({ ...form, isRental: !form.isRental })}
                >
                  <div className={styles.offerCardHeader}>
                    <input
                      type="checkbox"
                      checked={form.isRental}
                      onChange={(e) => setForm({ ...form, isRental: e.target.checked })}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.offerCheckbox}
                      id="opt-rental"
                    />
                    <label htmlFor="opt-rental" className={styles.offerTitle}>
                      Event Rental
                    </label>
                    <span className={styles.offerTag}>RECOMMENDED</span>
                  </div>
                  <p className={styles.offerDesc}>
                    Keep piece in your archive while earning repeat rental income for 4-day to 8-day milestone events.
                  </p>
                </div>

                {/* Pre-Loved Resale Card */}
                <div
                  className={`${styles.offerCard} ${form.isSale ? styles.offerCardActive : ''}`}
                  onClick={() => setForm({ ...form, isSale: !form.isSale })}
                >
                  <div className={styles.offerCardHeader}>
                    <input
                      type="checkbox"
                      checked={form.isSale}
                      onChange={(e) => setForm({ ...form, isSale: e.target.checked })}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.offerCheckbox}
                      id="opt-sale"
                    />
                    <label htmlFor="opt-sale" className={styles.offerTitle}>
                      Pre-Loved Purchase
                    </label>
                  </div>
                  <p className={styles.offerDesc}>
                    Offer piece for permanent ownership transfer with instant one-time buyer checkout.
                  </p>
                </div>
              </div>

              {/* Rental Pricing Inputs */}
              {form.isRental && (
                <div className={styles.pricingSubgrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="rental-price" className={styles.label}>
                      Daily Rental Rate (₹) <span className={styles.req}>*</span>
                    </label>
                    <div className={styles.currencyInputWrapper}>
                      <span className={styles.currencySymbol}>₹</span>
                      <input
                        id="rental-price"
                        type="number"
                        min="100"
                        step="50"
                        placeholder="1200"
                        className={`${styles.input} ${styles.inputCurrency}`}
                        value={form.rentalPriceRupees}
                        onChange={(e) => setForm({ ...form, rentalPriceRupees: e.target.value })}
                        required={form.isRental}
                      />
                    </div>
                    {form.rentalPriceRupees > 0 && (
                      <span className={styles.calcHint}>
                        Estimated 4-day rental subtotal: <strong>₹{fourDaySubtotal.toLocaleString('en-IN')}</strong>
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="deposit-price" className={styles.label}>
                      Security Deposit (₹)
                    </label>
                    <div className={styles.currencyInputWrapper}>
                      <span className={styles.currencySymbol}>₹</span>
                      <input
                        id="deposit-price"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="2500"
                        className={`${styles.input} ${styles.inputCurrency}`}
                        value={form.depositRupees}
                        onChange={(e) => setForm({ ...form, depositRupees: e.target.value })}
                      />
                    </div>
                    <span className={styles.hint}>100% refundable upon garment return inspection.</span>
                  </div>
                </div>
              )}

              {/* Retail Value Anchor */}
              <div className={styles.formGroup}>
                <label htmlFor="retail-price" className={styles.label}>
                  Original Retail Value (₹) <span className={styles.req}>*</span>
                </label>
                <div className={styles.currencyInputWrapper}>
                  <span className={styles.currencySymbol}>₹</span>
                  <input
                    id="retail-price"
                    type="number"
                    min="500"
                    step="500"
                    placeholder="25000"
                    className={`${styles.input} ${styles.inputCurrency}`}
                    value={form.replacementValueRupees}
                    onChange={(e) => setForm({ ...form, replacementValueRupees: e.target.value })}
                    required
                  />
                </div>
                {retailSavingPct && retailSavingPct > 0 ? (
                  <span className={styles.savingBadge}>
                    ✨ Renters save {retailSavingPct}% compared to buying retail!
                  </span>
                ) : null}
              </div>

              {/* Pre-Loved Sale Price */}
              {form.isSale && (
                <div className={styles.formGroup}>
                  <label htmlFor="sale-price" className={styles.label}>
                    Buy-Now Sale Price (₹) <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.currencyInputWrapper}>
                    <span className={styles.currencySymbol}>₹</span>
                    <input
                      id="sale-price"
                      type="number"
                      min="500"
                      step="100"
                      placeholder="9500"
                      className={`${styles.input} ${styles.inputCurrency}`}
                      value={form.salePriceRupees}
                      onChange={(e) => setForm({ ...form, salePriceRupees: e.target.value })}
                      required={form.isSale}
                    />
                  </div>
                  <span className={styles.hint}>Permanent purchase price for the garment.</span>
                </div>
              )}

              {/* Delivery Logistics */}
              <div className={styles.dispatchOptionBox}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.deliveryAvailable}
                    onChange={(e) => setForm({ ...form, deliveryAvailable: e.target.checked })}
                    className={styles.offerCheckbox}
                  />
                  <div className={styles.checkboxInfo}>
                    <span className={styles.checkboxTitle}>Complimentary Courier Pickup & Delivery</span>
                    <span className={styles.checkboxDesc}>
                      Insured doorstep courier pickup and reverse logistics handled completely by Exchange.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions Bar */}
            <div className={styles.actionsBar}>
              <Link to="/listings" className={styles.cancelBtn}>
                ← Back to Catalog
              </Link>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={busy || !form.title.trim()}
              >
                {busy ? 'Publishing Outfit to Atelier…' : 'Publish Outfit to Atelier →'}
              </button>
            </div>
          </form>

          {/* ── Right Column: Sticky Live Catalog Preview ── */}
          <aside className={styles.previewCol} aria-label="Live Catalog Preview">
            <div className={styles.stickyPreview}>
              <div className={styles.previewHeader}>
                <span className={styles.previewBadge}>✦ LIVE CATALOG PREVIEW</span>
                <span className={styles.previewSubBadge}>
                  {mediaItems.length > 0
                    ? `${mediaItems.filter((m) => m.mediaType !== 'video').length} Photos • ${mediaItems.filter((m) => m.mediaType === 'video').length} Runway Videos`
                    : 'REAL-TIME CARD PROJECTION'}
                </span>
              </div>

              {/* Mirror of ListingCard */}
              <article className={styles.previewCard}>
                <div className={styles.previewImgFrame}>
                  {(() => {
                    const activePreviewMedia = mediaItems[previewActiveIndex] || primaryItem || null;
                    if (!activePreviewMedia?.url) {
                      return (
                        <div className={styles.previewNoImg}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                          </svg>
                          <span>Atelier Media Pending</span>
                        </div>
                      );
                    }

                    if (activePreviewMedia.mediaType === 'video') {
                      return (
                        <video
                          key={activePreviewMedia.url}
                          src={activePreviewMedia.url}
                          controls
                          autoPlay
                          muted
                          loop
                          playsInline
                          className={styles.previewVideo}
                        />
                      );
                    }

                    return (
                      <img
                        src={activePreviewMedia.url}
                        alt={form.title || 'Outfit Preview'}
                        className={styles.previewImg}
                        onError={() => setImageLoadError(true)}
                      />
                    );
                  })()}

                  {/* Overlays */}
                  <div className={styles.cardBadges}>
                    {form.isRental && <span className={styles.badgeRental}>Rent</span>}
                    {form.isSale && <span className={styles.badgeSale}>Pre-Loved</span>}
                  </div>

                  {form.size && (
                    <div className={styles.sizeIndicator}>
                      <span>Size {form.size}</span>
                    </div>
                  )}
                </div>

                {/* Micro Thumbnail Strip for Multiple Media Items */}
                {mediaItems.length > 1 && (
                  <div className={styles.previewThumbStrip}>
                    {mediaItems.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.previewThumbBtn} ${previewActiveIndex === idx ? styles.previewThumbBtnActive : ''}`}
                        onClick={() => setPreviewActiveIndex(idx)}
                        aria-label={`Preview media ${idx + 1}`}
                      >
                        {item.mediaType === 'video' ? (
                          <div className={styles.previewVideoThumbWrapper}>
                            <video src={item.url} className={styles.previewThumbMedia} muted preload="metadata" />
                            <span className={styles.previewVideoPlayBadge}>▶</span>
                          </div>
                        ) : (
                          <img src={item.url} alt="" className={styles.previewThumbMedia} />
                        )}
                        {item.isPrimary && <span className={styles.previewCoverDot} title="Primary Cover" />}
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.previewCardContent}>
                  <div className={styles.previewBrandRow}>
                    <span className={styles.previewBrand}>
                      {form.brand || 'DESIGNER ARCHIVE'}
                    </span>
                    {form.city && <span className={styles.previewCity}>{form.city}</span>}
                  </div>

                  <h3 className={styles.previewTitle}>
                    {form.title || 'Untitled Designer Garment'}
                  </h3>

                  <div className={styles.previewPricing}>
                    {form.isRental && form.rentalPriceRupees ? (
                      <div className={styles.previewRental}>
                        <span className={styles.rentalPrice}>
                          ₹{Number(form.rentalPriceRupees).toLocaleString('en-IN')}
                        </span>
                        <span className={styles.rentalPeriod}>/ day</span>
                      </div>
                    ) : null}

                    {form.isSale && form.salePriceRupees ? (
                      <span className={styles.salePriceTag}>
                        {form.isRental ? `or Buy ₹${Number(form.salePriceRupees).toLocaleString('en-IN')}` : `₹${Number(form.salePriceRupees).toLocaleString('en-IN')} buy`}
                      </span>
                    ) : null}

                    {form.replacementValueRupees ? (
                      <span className={styles.previewRetail}>
                        ₹{Number(form.replacementValueRupees).toLocaleString('en-IN')} retail
                      </span>
                    ) : null}

                    {!form.rentalPriceRupees && !form.salePriceRupees && (
                      <span className={styles.pricingPending}>Set pricing in Step 04</span>
                    )}
                  </div>
                </div>
              </article>

              {/* Earnings Estimator Card */}
              <div className={styles.earningsCard}>
                <div className={styles.earningsHeader}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12M17 10h-7a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H7" />
                  </svg>
                  <span className={styles.earningsTitle}>Estimated Closet Revenue</span>
                </div>
                {form.rentalPriceRupees > 0 ? (
                  <>
                    <div className={styles.earningsRow}>
                      <span>6 Weekend Rentals / Year</span>
                      <strong>
                        ₹{((Number(form.rentalPriceRupees) * 4) * 6).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div className={styles.earningsSubRow}>
                      <span>₹{(Number(form.rentalPriceRupees) * 4).toLocaleString('en-IN')} per 4-day booking</span>
                    </div>
                  </>
                ) : (
                  <div className={styles.earningsPrompt}>
                    Enter daily rental rate in Step 04 to calculate annual closet earnings.
                  </div>
                )}
                <p className={styles.earningsNote}>
                  Verified courier pickup, inspection, and return shipping handled completely by Exchange.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
