let storiesCache = [];

export const setStoriesCache = (data) => {
  storiesCache = data;
};

export const getStoriesCache = () => {
  return storiesCache;
};

export const clearStoriesCache = () => {
  storiesCache = [];
};
