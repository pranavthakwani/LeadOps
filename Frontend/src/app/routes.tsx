import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Dashboard } from '../pages/Dashboard';
import { Inbox } from '../pages/Inbox';
import { MessageDetail } from '../pages/MessageDetail';
import { Contacts } from '../pages/Contacts';
import { Settings } from '../pages/Settings';
import { SearchPage } from '../pages/Search';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'inbox',
        element: <Inbox />,
      },
      {
        path: 'message/:id',
        element: <MessageDetail />,
      },
      {
        path: 'contacts',
        element: <Contacts />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'search',
        element: <SearchPage />,
      },
    ],
  },
]);
