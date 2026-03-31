import axios from 'axios';

const api = axios.create({
  baseURL: '', // Use Vite proxy
  timeout: 10000,
});

export const getIgnoredMessages = async () => {
  try {
    const response = await api.get('/api/ignored');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching ignored messages:', error);
    throw error;
  }
};
