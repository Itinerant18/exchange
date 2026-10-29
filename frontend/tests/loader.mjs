export async function load(url, context, nextLoad) {
  if (url.includes('appConfig.js')) {
    const raw = await nextLoad(url, context);
    const modified = raw.source.toString().replaceAll('import.meta.env', 'globalThis.__VITE_ENV__');
    return {
      format: 'module',
      shortCircuit: true,
      source: `globalThis.__VITE_ENV__ = globalThis.__VITE_ENV__ || { VITE_API_BASE_URL: 'http://127.0.0.1:5000/api/v1', MODE: 'test' };\n${modified}`,
    };
  }
  return nextLoad(url, context);
}
