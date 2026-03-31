// Generate unique color per sender (deterministic)
export const getColorFromString = (str: string) => {
  const colors = [
    '#e57373', '#64b5f6', '#81c784', '#ffb74d',
    '#ba68c8', '#4db6ac', '#f06292', '#9575cd'
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};
