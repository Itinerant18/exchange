import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { appConfig } from '../config/appConfig.js';
import { AppProviders } from './providers.jsx';
import { router } from './router.jsx';

export default function App() {
  useEffect(() => {
    document.title = appConfig.name;
  }, []);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
