import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';
import { Loader2 } from 'lucide-react-native';

interface LoaderProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function Loader({ size = 20, color = 'rgba(255, 255, 255, 0.8)', style }: LoaderProps) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startRotation = () => {
      rotation.setValue(0);
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };

    startRotation();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Loader2 size={size} color={color} />
      </Animated.View>
    </View>
  );
}
