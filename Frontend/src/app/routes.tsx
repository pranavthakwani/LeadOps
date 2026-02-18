import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Dashboard } from '../pages/Dashboard';
import { Inbox } from '../pages/Inbox';
import { Search } from '../pages/Search';
import { MessageDetail } from '../pages/MessageDetail';
import { Settings } from '../pages/Settings';

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
        path: 'search',
        element: <Search />,
      },
      {
        path: 'message/:id',
        element: <MessageDetail />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
]);
