import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  color?: string;
  glow?: boolean;
};

export default function GlowingIcon({
  children,
  color = '#FF5C7C',
  glow = false,
}: Props): React.ReactElement {
  return (
    <View
      style={[
        styles.container,
        glow
          ? {
              shadowColor: color,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.16,
              shadowRadius: 18,
            }
          : undefined,
      ]}>
      {children}
      {/* subtle halo */}
      <View
        style={[
          styles.halo,
          glow
            ? {
                backgroundColor: color + '22',
              }
            : { backgroundColor: 'transparent' },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 999,
  },
});