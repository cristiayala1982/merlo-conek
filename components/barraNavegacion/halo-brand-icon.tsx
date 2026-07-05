import { Image } from 'react-native';

type HaloBrandIconProps = {
  size?: number;
};

export function HaloBrandIcon({
  size = 35,
}: HaloBrandIconProps) {
  return (
    <Image
      source={require('../../assets/images/iconoApp.png')}
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}
