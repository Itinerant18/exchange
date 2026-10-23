import { AuthProvider } from '../context/AuthContext.jsx';

export function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
