import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Sparkles, Users, Wallet } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Dimensions, FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: "Track the Drip 💧",
    desc: "Log your munchies, tech, and commutes in seconds. No boring spreadsheets, just pure vibes.",
    icon: Wallet,
    color: '#8b5cf6' // Primary Purple
  },
  {
    id: '2',
    title: "Get AI Roasted 🤖",
    desc: "Our AI judges your spending habits. It’s like having a financial advisor, but way funnier.",
    icon: Sparkles,
    color: '#d946ef' // Accent Pink
  },
  {
    id: '3',
    title: "Split with the Squad 🤝",
    desc: "Bill splitting made easy. Track who owes you money without the awkward conversations.",
    icon: Users,
    color: '#10b981' // Success Green
  }
];

const OnboardingItem = ({ item, index, scrollX }: any) => {
  const rnAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <View style={styles.slide}>
      <Animated.View style={[styles.iconContainer, rnAnimatedStyle]}>
        <LinearGradient
          colors={[item.color, '#000']}
          style={styles.circleGradient}
        >
          <item.icon size={80} color="white" />
        </LinearGradient>
      </Animated.View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
        <Text style={styles.desc}>{item.desc}</Text>
      </View>
    </View>
  );
};

const PaginatorDot = ({ index, scrollX }: { index: number; scrollX: any }) => {
  const dotStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const w = interpolate(scrollX.value, inputRange, [10, 20, 10], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP);
    return { width: w, opacity };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
};

export default function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: any) => {
    scrollX.value = event.nativeEvent.contentOffset.x;
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#09090b', '#18181b']} style={StyleSheet.absoluteFill} />      

      {/* BACKGROUND DECORATION */}
      <View style={styles.bgGlow} />

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({ item, index }) => <OnboardingItem item={item} index={index} scrollX={scrollX} />}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onViewableItemsChanged={handleViewableItemsChanged}
        scrollEventThrottle={16}
      />

      {/* FOOTER CONTROLS */}
      <View style={styles.footer}>
        {/* Paginator */}
        <View style={styles.paginator}>
          {SLIDES.map((_, i) => (
            <PaginatorDot key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity onPress={handleNext} style={styles.btn}>
          <LinearGradient
            colors={currentIndex === SLIDES.length - 1 ? ['#10b981', '#059669'] : ['#8b5cf6', '#d946ef']}
            style={styles.btnGradient}
          >
            {currentIndex === SLIDES.length - 1 ? (
               <Text style={styles.btnText}>Get Started</Text>
            ) : (
               <ArrowRight color="white" size={24} />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  slide: { width, height: height * 0.75, justifyContent: 'center', alignItems: 'center', padding: 20 },
  bgGlow: {
    position: 'absolute', top: -100, left: -100, width: 400, height: 400,
    backgroundColor: 'rgba(139, 92, 246, 0.15)', borderRadius: 200
    // blurRadius is not supported in ViewStyle; consider using shadow or a blurred Image if you want a blur effect
  },
  circleGradient: {
    width: 200, height: 200, borderRadius: 100,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#8b5cf6', shadowOpacity: 0.5, shadowRadius: 30, elevation: 20
  },
  iconContainer: { marginBottom: 40 },
  textContainer: { alignItems: 'center', paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 15, textTransform: 'uppercase' },
  desc: { fontSize: 16, color: '#a1a1aa', textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },
  footer: { height: height * 0.25, paddingHorizontal: 30, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' },
  paginator: { flexDirection: 'row', gap: 10 },
  dot: { height: 10, borderRadius: 5, backgroundColor: 'white' },
  btn: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  btnGradient: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
