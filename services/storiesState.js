let storiesCache = [];
let shouldOpenStories = false;
let seenLocalMap = new Map(); // Memoria rápida: userId -> timestamp de último visto

export const setStoriesCache = (data) => {
  storiesCache = data;
};

export const getStoriesCache = () => {
  return storiesCache;
};

export const markLocalSeen = (userId) => {
  seenLocalMap.set(userId, Date.now());
};

export const isLocalSeen = (userId, storyTime) => {
  const seenAt = seenLocalMap.get(userId);
  if (!seenAt) return false;
  return storyTime <= seenAt;
};

export const clearStoriesCache = () => {
  storiesCache = [];
};

export const setShouldOpenStories = (val) => {
  shouldOpenStories = val;
};

export const getShouldOpenStories = () => {
  return shouldOpenStories;
};

export const resetShouldOpenStories = () => {
  shouldOpenStories = false;
};
