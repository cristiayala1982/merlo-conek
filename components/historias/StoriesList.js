import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import UserStoryCircle from './UserStoryCircle';
import OtherStoryCircle from './OtherStoryCircle';

const StoriesList = ({
  user,
  userStories,
  otherStories,
  onAddPress,
  onViewUserStories,
  onManageUserStories,
  onViewOtherStories,
  lastStoriesCheck
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <UserStoryCircle
        user={user}
        hasStories={userStories && userStories.length > 0}
        onAddPress={onAddPress}
        onViewStories={onViewUserStories}
        onManageStories={onManageUserStories}
      />
      {otherStories.map((item) => {
        // Calculate if seen: if the latest story of this user is older than our last check
        const latestStoryTime = item.createdAt?.toMillis ? item.createdAt.toMillis() : 0;
        const isSeen = lastStoriesCheck ? (latestStoryTime <= lastStoriesCheck) : false;

        return (
          <OtherStoryCircle
            key={item.id || item.userId}
            story={item}
            onPress={() => onViewOtherStories(item.userId)}
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
});

export default StoriesList;
