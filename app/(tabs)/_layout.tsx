import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { Home, Megaphone, PieChart, Plus, User, Users } from 'lucide-react-native'; // Added Megaphone
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native'; // Added Text

import { HapticTab } from '../../components/haptic-tab';

export default function TabLayout() {

  return (
    <LinearGradient
      colors={['#09090b', '#18181b']}
      style={{ flex: 1 }}
    >
      {/* Main Content Area */}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#8b5cf6',
            tabBarInactiveTintColor: '#71717a',
            tabBarShowLabel: false,
            tabBarButton: HapticTab,
            tabBarStyle: styles.tabBar,
          }}>
          
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color }) => <Home size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: 'Insights',
              tabBarIcon: ({ color }) => <PieChart size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="add"
            options={{
              title: 'Add',
              tabBarIcon: ({ color }) => (
                <View style={styles.plusBtn}>
                  <Plus size={28} color="white" />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: 'Split',
              tabBarIcon: ({ color }) => <Users size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color }) => <User size={24} color={color} />,
            }}
          />
        </Tabs>
      </View>

      {/* GLOBAL BOTTOM AD BANNER */}
      <View style={styles.globalAdContainer}>
        <LinearGradient 
          colors={['#18181b', '#09090b']} 
          start={{x:0, y:0}} end={{x:1, y:0}}
          style={styles.globalAdContent}
        >
          <View style={styles.adBadge}><Text style={styles.adBadgeText}>AD</Text></View>
          <View style={{flex: 1, paddingHorizontal: 10}}>
            <Text style={styles.adTitle}>Premium Trading</Text>
            <Text style={styles.adSub}>Zero brokerage for 30 days*</Text>
          </View>
          <Megaphone size={18} color="#fbbf24" />
        </LinearGradient>
      </View>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 25, // Floats above the bottom view
    left: 20,
    right: 20,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: '#09090b',
    elevation: 5,
  },
  // New Styles for Global Ad
  globalAdContainer: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10, // Handle safe area
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  globalAdContent: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  adBadge: { backgroundColor: '#fbbf24', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adBadgeText: { fontSize: 10, fontWeight: '900', color: 'black' },
  adTitle: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  adSub: { color: '#a1a1aa', fontSize: 11 }
});