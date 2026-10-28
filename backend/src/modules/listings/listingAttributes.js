// Facet taxonomy for structured listing attributes (Phase 3).
//
// A listing carries a small JSONB bag: facet key -> array of enum values.
// Both the writer (create/update listing) and the discovery filters (browse
// page) validate against this single taxonomy so PLP facets, counts, and the
// FilterModal on the client always agree with what is stored.

export const FACETS = Object.freeze({
  occasion: [
    'WeddingGuest', 'Cocktail', 'BlackTie', 'Gala', 'DateNight',
    'Festive', 'Workwear', 'Casual', 'Vacation',
  ],
  neckline: [
    'VNeck', 'Crew', 'Sweetheart', 'Halter', 'OffShoulder', 'Turtleneck',
  ],
  sleeve: [
    'Sleeveless', 'CapSleeve', 'ShortSleeve', 'ThreeQuarter', 'LongSleeve',
  ],
  length: ['Mini', 'Midi', 'Maxi', 'FloorLength', 'HighLow'],
  print: ['Solid', 'Floral', 'Animal', 'PolkaDot', 'Striped', 'Embroidered'],
  embellishment: ['Sequins', 'Ruffles', 'Cutouts', 'Pleats', 'Beading'],
  stylePersona: ['Classic', 'Bohemian', 'Minimalist', 'Romantic', 'Glamorous'],
  seasonality: ['SpringSummer', 'FallWinter', 'Resort', 'YearRound'],
  maternity: ['MaternityFriendly', 'NotMaternity'],
});

export const FACET_KEYS = Object.keys(FACETS);

const MAX_KEYS = 8;
const MAX_VALUES_PER_FACET = 10;

/**
 * Validates and normalizes a client-supplied `attributes` bag. Returns a
 * plain object { facetKey: [values...] } or throws a 400 AppError on any
 * unsupported key, non-array values, or non-enum values.
 */
export function validateListingAttributes(input, AppError) {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('attributes must be an object of facet keys to arrays of values.', { statusCode: 400 });
  }
  const keys = Object.keys(input);
  if (keys.length > MAX_KEYS) {
    throw new AppError(`attributes supports at most ${MAX_KEYS} facets.`, { statusCode: 400 });
  }
  const result = {};
  for (const key of keys) {
    if (!FACET_KEYS.includes(key)) {
      throw new AppError(`attributes.${key} is not a supported facet. Supported facets: ${FACET_KEYS.join(', ')}.`, {
        statusCode: 400,
      });
    }
    const rawValues = input[key];
    if (!Array.isArray(rawValues)) {
      throw new AppError(`attributes.${key} must be an array of values.`, { statusCode: 400 });
    }
    const values = [];
    for (const rawValue of rawValues) {
      if (typeof rawValue !== 'string') {
        throw new AppError(`attributes.${key} values must be strings.`, { statusCode: 400 });
      }
      const normalized = rawValue.trim();
      if (normalized.length === 0 || normalized.length > 40) {
        throw new AppError(`attributes.${key} values must be between 1 and 40 characters.`, { statusCode: 400 });
      }
      const match = FACETS[key].find((candidate) => candidate.toLowerCase() === normalized.toLowerCase());
      if (!match) {
        throw new AppError(`attributes.${key} must contain only: ${FACETS[key].join(', ')}.`, { statusCode: 400 });
      }
      if (!values.includes(match)) {
        values.push(match);
      }
    }
    if (values.length === 0) {
      continue; // empty arrays are dropped rather than stored
    }
    if (values.length > MAX_VALUES_PER_FACET) {
      throw new AppError(`attributes.${key} supports at most ${MAX_VALUES_PER_FACET} values.`, { statusCode: 400 });
    }
    result[key] = values;
  }
  return result;
}

/**
 * Parses discovery facet filters from a query string: repeated or
 * comma-separated enum values per facet key (e.g. ?occasion=Cocktail,BlackTie).
 * Returns { occasion: ['Cocktail', 'BlackTie'], ... } or null when absent.
 */
export function parseFacetFilters(query, AppError) {
  const result = {};
  for (const key of FACET_KEYS) {
    const raw = query[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const values = String(raw)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    if (values.length > MAX_VALUES_PER_FACET) {
      throw new AppError(`${key} accepts at most ${MAX_VALUES_PER_FACET} values.`, { statusCode: 400 });
    }
    const enumValues = [];
    for (const value of values) {
      const match = FACETS[key].find((candidate) => candidate.toLowerCase() === value.toLowerCase());
      if (!match) {
        throw new AppError(`${key} must be one of: ${FACETS[key].join(', ')}.`, { statusCode: 400 });
      }
      if (!enumValues.includes(match)) enumValues.push(match);
    }
    result[key] = enumValues;
  }
  return Object.keys(result).length > 0 ? result : null;
}
