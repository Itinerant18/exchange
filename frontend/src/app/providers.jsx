export function AppProviders({ children }) {
  // Add auth, theme, or notification providers here when those foundations
  // exist. Keeping the boundary explicit avoids scattering providers later.
  return children;
}
