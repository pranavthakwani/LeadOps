/**
 * Time utility functions for consistent IST formatting across the application
 */

/**
 * Safely converts various timestamp formats to Date object
 * @param timestamp - The timestamp (number, string, or Date object)
 * @returns Date object
 */
const toDate = (timestamp: number | string | Date): Date => {
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  return new Date(timestamp); // handles ISO string and SQL datetime
};

/**
 * Formats time in IST to match chat interface format (e.g., "2:30 pm")
 * @param timestamp - The timestamp (number, string, or Date object)
 * @returns Formatted time string in IST
 */
export const formatISTTime = (timestamp: number | string | Date): string => {
  const date = toDate(timestamp);

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).toLowerCase();
};

/**
 * Formats date in IST to match chat interface format (e.g., "Mon, Dec 25")
 * @param timestamp - The timestamp (number, string, or Date object)
 * @returns Formatted date string in IST
 */
export const formatISTDate = (timestamp: number | string | Date): string => {
  const date = toDate(timestamp);

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

/**
 * Formats date and time in IST (e.g., "Mon, Dec 25 • 2:30 pm")
 * @param timestamp - The timestamp (number, string, or Date object)
 * @returns Formatted date and time string in IST
 */
export const formatISTDateTime = (timestamp: number | string | Date): string => {
  return `${formatISTDate(timestamp)} • ${formatISTTime(timestamp)}`;
};

/**
 * Formats short date in IST (e.g., "25 Dec")
 * @param timestamp - The timestamp (number, string, or Date object)
 * @returns Formatted short date string in IST
 */
export const formatISTShortDate = (timestamp: number | string | Date): string => {
  const date = toDate(timestamp);

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata'
  });
};
