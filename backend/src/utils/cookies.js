// Cookie header parsing without an extra dependency (express 5 does not
// include a cookie body parser).

/** Parses a `Cookie` header into a plain object. Duplicate names keep the first. */
export function parseCookies(header) {
  const jar = Object.create(null);
  if (typeof header !== 'string' || header.length === 0) return jar;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    let value = pair.slice(separator + 1).trim();
    if (!name) continue;
    if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
      // Optional quoted RFC form.
      value = value.slice(1, -1);
    }
    try {
      value = decodeURIComponent(value);
    } catch {
      // Malformed escape: keep the raw value.
    }
    if (!(name in jar)) jar[name] = value;
  }
  return jar;
}
