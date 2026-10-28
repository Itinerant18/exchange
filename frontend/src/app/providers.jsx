import { AuthProvider } from '../context/AuthContext.jsx';
import { BagProvider } from '../context/BagContext.jsx';
import { FavoritesProvider } from '../context/FavoritesContext.jsx';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <BagProvider>{children}</BagProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
