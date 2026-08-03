import React from 'react';
import StoryCircle from './StoryCircle';

const OtherStoryCircle = ({ story, onPress }) => {
  // In a real app, we'd check if all stories for this user are seen
  // For now, we can pass it as a prop or assume based on some data
  const isSeen = story?.visto || false;

  return (
    <StoryCircle
      image={story?.userPhotoUrl}
      name={story?.userName}
      isSeen={isSeen}
      onPress={onPress}
    />
  );
};

export default OtherStoryCircle;
