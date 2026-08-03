import React from 'react';
import StoryCircle from './StoryCircle';

const UserStoryCircle = ({ user, hasStories, onAddPress, onViewStories, onManageStories }) => {
  return (
    <StoryCircle
      isUser={true}
      image={user?.fotoUrl}
      name={user?.nombre || 'Tú'}
      showPlus={true}
      onPlusPress={onAddPress}
      onPress={hasStories ? onViewStories : onAddPress}
      onLongPress={onManageStories}
    />
  );
};

export default UserStoryCircle;
