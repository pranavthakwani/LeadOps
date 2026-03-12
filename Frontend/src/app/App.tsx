import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { router } from './routes';
import { WhatsAppProvider } from '../context/WhatsAppConnectionContext';
import { WhatsAppAuthModal } from '../components/WhatsAppAuthModal';

export const App: React.FC = () => {
  return (
    <WhatsAppProvider>
      <Providers>
        <RouterProvider router={router} />
        <WhatsAppAuthModal />
      </Providers>
    </WhatsAppProvider>
  );
};
