import { AuthProvider } from '../context/AuthContext.jsx';
import { BagProvider } from '../context/BagContext.jsx';
import { FavoritesProvider } from '../context/FavoritesContext.jsx';
import { ToastProvider } from '../components/feedback/index.js';

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <BagProvider>{children}</BagProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
