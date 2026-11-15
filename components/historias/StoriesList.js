import React from 'react';
import { ScrollView, StyleSheet, View, Dimensions } from 'react-native';
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
      // Quitamos propiedades de snap que puedan bloquear el scroll si el ancho no es exacto
      decelerationRate="normal"
      contentContainerStyle={styles.scrollContent}
      // Aseguramos que el scroll sea independiente
      nestedScrollEnabled={true}
      // Esta propiedad es clave en Android cuando está dentro de otros componentes absolutos
      scrollEnabled={true}
    >
      <View style={styles.row}>
        <UserStoryCircle
          user={user}
          hasStories={userStories && userStories.length > 0}
          onAddPress={onAddPress}
          onViewStories={onViewUserStories}
          onManageStories={onManageUserStories}
        />
        {otherStories.map((item) => {
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    // Eliminamos flexGrow para evitar que se estire y bloquee el scroll
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});

export default StoriesList;
