/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertCircle,
  ArrowUpRight,
  Car,
  Coffee,
  Edit2,
  Film,
  Languages,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  Repeat,
  Send,
  Shield,
  ShoppingBag, Smartphone,
  Sparkles,
  Wallet,
  WifiOff,
  X,
  Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar, StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View
} from 'react-native';
// Add useFocusEffect to the imports

// AUTH & FIREBASE
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';

// Add 'functions' to your firebaseConfig import
import { auth, db } from '../../firebaseConfig';

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

import {
  addDoc,
  collection,
  deleteDoc, doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc, where
} from 'firebase/firestore';
 

// NEW: Notifications
// import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useUser } from '../../context/UserContext'; // ADD THIS IMPORT
import { registerForPushNotificationsAsync, sendLocalNotification } from '../../services/notifications';

// --- 🔑 SECURE KEYS ---
const GOOGLE_WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

// --- DEFINITIONS ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- THEME CONFIG ---
const THEME = {
  bg: '#09090b',
  card: '#18181b',
  text: '#fafafa',
  subText: '#a1a1aa',
  primary: '#8b5cf6',
  accent: '#d946ef',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
};

// Ad Unit ID — use TestIds.BANNER in dev to avoid policy issues
//const adUnitId: string = __DEV__ ? TestIds.BANNER : 'ca-app-pub-2729715073425515/6271945631';

const CATEGORIES = [
  { id: 'food', label: 'Munchies', icon: Coffee, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'transport', label: 'Commute', icon: Car, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  { id: 'shopping', label: 'Drip', icon: ShoppingBag, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  { id: 'tech', label: 'Tech', icon: Smartphone, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  { id: 'bills', label: 'Bills', icon: Zap, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  { id: 'fun', label: 'Vibes', icon: Film, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
];

const TRANSLATIONS: { [key: string]: any } = {
  en: {
    net_worth: "Total Stash", recent: "Recent Moves", add_expense: "Drop Money",
    spending: "The Damage", invest_title: "Grow Your Stash 🚀", risk_profile: "Investor Vibe",
    start_investing: "Start Investing", login_title: "Login",
    login_sub: "Track your money like a pro.",
    google_btn: "Continue with Google"
  },
  hi: {
    net_worth: "कुल जमा", recent: "हालिया खर्च", add_expense: "खर्च जोड़ें",
    spending: "खर्च का विवरण", invest_title: "पैसे बढ़ाओ 🚀", risk_profile: "निवेश शैली",
    start_investing: "शुरुआत करें", login_title: "लॉग इन",
    login_sub: "अपने पैसों का हिसाब रखें",
    google_btn: "Google से जारी रखें"
  }
};

const getGreeting = (lang: any) => {
  const hour = new Date().getHours();
  if (lang === 'hi') return "नमस्ते";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

// --- HELPER: CALCULATE NEXT DUE DATE ---
const getNextDueDate = (dateStr: string, frequency: string) => {
  const date = new Date(dateStr);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
};

// --- 1. AUTH SCREEN ---
const AuthScreen = ({ onLogin }: { onLogin: any }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectUri = makeRedirectUri({
    scheme: 'dhanvayu'
  });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_ID,
    androidClientId: GOOGLE_ANDROID_ID,
    redirectUri: redirectUri, 
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential).catch((e) => {
        Alert.alert("Login Failed", (e as Error).message);
        setLoading(false);
      });
    } else if (response?.type === 'error') {
      Alert.alert("Google Sign-In Error", "Check your Google Cloud Console configuration.");
    }
  }, [response]);

  const handleAuth = async () => {
    if(!email || !password) return Alert.alert("Missing Info", "Please fill in all fields.");
    setLoading(true);
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) { Alert.alert("Error", (e as Error).message); setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#2e1065', '#09090b']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.authContent}>
        <View style={styles.glassCard}>
          <View style={styles.logoGlow}>
            <Sparkles size={32} color={THEME.accent} fill={THEME.accent} />
          </View>
          <Text style={styles.authTitle}>{isLogin ? "Welcome Back" : "Join the Squad"}</Text>
          <Text style={styles.authSub}>{TRANSLATIONS.en.login_sub}</Text>
          
          <TouchableOpacity 
            style={styles.googleBtn} 
            disabled={!request}
            onPress={() => promptAsync()}
            activeOpacity={0.8}
          >
            <Text style={styles.googleBtnText}>G  {TRANSLATIONS.en.google_btn}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} /><Text style={styles.orText}>OR</Text><View style={styles.line} />
          </View>
          
          <TextInput 
            style={styles.input} placeholder="Email" placeholderTextColor="#52525b"
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          />
          <TextInput 
            style={styles.input} placeholder="Password" placeholderTextColor="#52525b"
            value={password} onChangeText={setPassword} secureTextEntry 
          />
          
          <TouchableOpacity onPress={handleAuth} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={['#d946ef', '#8b5cf6']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.mainBtn}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{isLogin ? "Let's Go" : "Sign Up"}</Text>}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
            <Text style={styles.switchText}>{isLogin ? "New here? Create Account" : "Already have an account? Login"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- LOCK SCREEN REMOVED ---
// Lock screen is now handled securely in app/_layout.tsx with SecurePinService


// --- 2. MAIN APP ---
export default function HomeScreen() {
  const user = auth.currentUser;
  // 1. Create local state for the name so React knows when to re-render
  const [displayName, setDisplayName] = useState(user?.displayName || '');

  // Use global currency symbol from context
  const { symbol: currencySymbol } = useUser();
  const router = useRouter();

  const [lang, setLang] = useState('en');
  const [activeTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showAiChat, setShowAiChat] = useState(false);
  const [riskProfile, setRiskProfile] = useState('moderate');
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const callGemini = async (prompt: string) => {
    if (!isConnected) return "You're offline. Connect to internet for roasted insights.";
    try {
      const response = await fetch('https://gemini-proxy-pi-steel.vercel.app/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.text || "AI is napping. Try later.";
    } catch (error) {
      console.error("Proxy Error:", error);
      return "AI brain freeze. Try again.";
    }
  };
  // NEW: Budget UI state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  // Add split balance state
  const [owedToYou, setOwedToYou] = useState(0);

  const [aiInsight, setAiInsight] = useState("Analysing your vibes...");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const t = TRANSLATIONS[lang];
  const greeting = getGreeting(lang);
  //  const startBalance = 15000; // removed hardcoded starting balance

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // NEW: Register for push notifications and optionally persist token
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token && user) {
        // optional: save token to Firestore users/{uid}/push_token
        setDoc(doc(db, 'users', user.uid, 'meta', 'push'), { token }, { merge: true }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Add this useEffect to listen to Splitwise data
  useEffect(() => {
    if (!user) return;
    // Listen to the split_expenses collection
    const q = query(collection(db, 'users', user.uid, 'split_expenses'));
    const unsub = onSnapshot(q, (snap) => {
      const splits = snap.docs.map(d => d.data());
      
      // Calculate total owed to YOU
      let total = 0;
      splits.forEach((s: any) => {
        if (s.paidBy === 'user') {
          // You paid, so add half the amount (assuming 50/50 split)
          total += (s.amount / 2);
        }
        // Note: You can expand this logic if you want to subtract what YOU owe
      });
      setOwedToYou(total);
    });
    return unsub;
  }, [user]);

  // --- RECURRING EXPENSE CHECKER ---
  useEffect(() => {
    if (!user || !isConnected) return;

    const checkRecurring = async () => {
      const q = query(
        collection(db, 'users', user.uid, 'expenses'), 
        where("isRecurring", "==", true)
      );
      
      try {
        const snapshot = await getDocs(q);
        const now = new Date();

        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          if (data.nextTriggerDate && new Date(data.nextTriggerDate) <= now) {
            
            // Create the NEW transaction for today (keep original type)
            await addDoc(collection(db, 'users', user.uid, 'expenses'), {
              title: data.title,
              amount: data.amount,
              category: data.category,
              date: new Date().toISOString(),
              type: data.type || 'expense',
              isRecurring: false, 
              generatedFrom: docSnap.id
            });

            const nextDate = getNextDueDate(data.nextTriggerDate, data.frequency || 'monthly');
            await updateDoc(doc(db, 'users', user.uid, 'expenses', docSnap.id), {
              nextTriggerDate: nextDate,
              lastProcessed: new Date().toISOString()
            });
            
            Alert.alert("Auto-Pay 🤖", `Processed recurring: ${data.title}`);

            // NEW: notify if due tomorrow
            try {
              const nextDt = new Date(nextDate);
              const diffTime = nextDt.getTime() - Date.now();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays === 1) {
                sendLocalNotification("Bill Due Tomorrow 📅", `Don't forget: ${data.title} of ₹${data.amount} is due tomorrow.`);
              }
            } catch (e) { /* ignore notification errors */ }
          }
        });
      } catch (e) {
        console.log("Error processing recurring:", e);
      }
    };

    checkRecurring();
  }, [user, isConnected]);


  const generateAiInsight = useCallback(async (txData: any) => {
    if (!isConnected) {
      setAiInsight("You're offline. Connect to internet for roasted insights.");
      return;
    }
    if (txData.length === 0) { setAiInsight("No data to roast yet."); return; }
    
    setLoadingInsight(true);
    const summary = txData.slice(0, 5).map((t:any) => `${t.title}: ${t.amount}`).join(', ');
    
    const prompt = `You are a Gen-Z financial friend. Here are my recent expenses: ${summary}. Give me a 1-sentence roast or compliment about my spending. Keep it short, funny, and slangy.`;
    
    const result = await callGemini(prompt);
    if (result) {
      setAiInsight(result);
    } else {
      setAiInsight("Connection was too weak for AI.");
    }
    setLoadingInsight(false);
  }, [isConnected]); // Add dependencies

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'expenses'), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(data);
      if (isConnected) {
         generateAiInsight(data);
      } else {
         setAiInsight("You're offline. AI is napping.");
      }
    }, (error) => {
      console.log("Snapshot error (possibly offline):", error);
    });
    return unsub;
  }, [user, isConnected, generateAiInsight]); // Now safe to add generateAiInsight

  // duplicate generateAiInsight removed (kept the useCallback version above)

  const handleDelete = async (id: any) => {
    Alert.alert("Delete Transaction", "This cannot be undone.", [
      { text: "Cancel", style: 'cancel' },
      { text: "Delete", style: 'destructive', onPress: async () => await deleteDoc(doc(db, 'users', user.uid, 'expenses', id)) }
    ]);
  };

  // Budget breach checker - sends local notification when adding expense exceeds budget
  const checkBudgetBreach = (category: string, newAmount: number) => {
    const limit = budgets[category] || 0;
    if (!limit || limit <= 0) return;

    // current spent (considering expense type as used elsewhere)
    const currentSpent = transactions
      .filter(t => (t.type === 'expense' || !t.type) && t.category === category)
      .reduce((acc, t) => acc + t.amount, 0);

    if ((currentSpent + newAmount) > limit) {
      const over = (currentSpent + newAmount - limit).toFixed(0);
      sendLocalNotification(
        "Budget Alert 🚨",
        `You've exceeded your ${category} limit by ₹${over}!`
      );
    }
  };

  // NEW: Fetch budgets for this user
  useEffect(() => {
    if (!user) return;
    // We store budgets in a single doc: users/{uid}/settings/budgets
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'settings', 'budgets'), (docSnap) => {
      if (docSnap.exists()) {
        setBudgets(docSnap.data());
      }
    });
    return unsub;
  }, [user]);

  // Helper: save budgets
  const saveBudgets = async (newBudgets: Record<string, number>) => {
    try {
      const budgetDocRef = doc(db, 'users', user.uid, 'settings', 'budgets'); // Changed path
      await setDoc(budgetDocRef, newBudgets, { merge: true });
      setShowBudgetModal(false);
      Alert.alert('Saved', 'Budgets updated.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  // CALCULATE BALANCES (Income - Expense)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalSpent = transactions
    .filter(t => t.type === 'expense' || !t.type)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const currentBalance = totalIncome - totalSpent;

  // CALCULATE BUDGET PROGRESS (Current Month Only)
  const budgetStats = React.useMemo(() => {
    const now = new Date();
    // Filter for current month only
    const thisMonthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && (t.type === 'expense' || !t.type);
    });

    return CATEGORIES.map(cat => {
      const spent = thisMonthTx.filter(t => t.category === cat.id).reduce((acc, t) => acc + t.amount, 0);
      const limit = budgets[cat.id] || 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const isBreached = limit > 0 && spent > limit;

      return { ...cat, spent, limit, percent, isBreached };
    }).filter(c => c.spent > 0 || c.limit > 0); // Show categories with spending or budgets set
  }, [transactions, budgets]);

  // --- INLINE AD (Reusable) ---
  const InlineAd = () => (
    <View style={styles.inlineAd}>
      <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
        <View style={{backgroundColor:'#fbbf24', paddingHorizontal:6, paddingVertical:2, borderRadius:4}}>
          <Text style={{fontSize:10, fontWeight:'bold', color:'black'}}>AD</Text>
        </View>
        <View>
          <Text style={{color:'white', fontWeight:'bold', fontSize:13}}>Get 5% Cashback</Text>
          <Text style={{color:'#a1a1aa', fontSize:11}}>Apply for the DhanVayu Card</Text>
        </View>
      </View>
      <Megaphone size={16} color="white" />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Offline Banner */}
      {isConnected === false && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="white" />
          <Text style={styles.offlineText}>Offline Mode - Changes will sync later</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.username}>{displayName || user?.email?.split('@')[0]}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowAiChat(true)} style={[styles.iconBtn, {borderColor: THEME.accent}]}>
            <MessageSquare size={20} color={THEME.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLang(l => l === 'en' ? 'hi' : 'en')} style={styles.iconBtn}>
            <Languages size={20} color={THEME.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut(auth)} style={[styles.iconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
            <LogOut size={20} color={THEME.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' ? (
          <View style={styles.content}>
            {/* AI Insight Card */}
            <TouchableOpacity 
              onPress={() => generateAiInsight(transactions)} 
              activeOpacity={0.8}
              disabled={!isConnected}
            >
              <LinearGradient 
                colors={isConnected ? ['#2e1065', '#4c1d95'] : ['#27272a', '#27272a']} 
                start={{x:0, y:0}} end={{x:1, y:0}} 
                style={styles.aiCard}
              >
                <View style={styles.aiHeader}>
                  <Sparkles size={16} color={isConnected ? THEME.accent : '#71717a'} />
                  <Text style={[styles.aiLabel, !isConnected && { color: '#71717a' }]}>
                    {isConnected ? "AI Vibe Check" : "AI Offline"}
                  </Text>
                </View>
                {loadingInsight ? (
                  <ActivityIndicator size="small" color={THEME.accent} style={{alignSelf:'flex-start', marginTop:5}} />
                ) : (
                  <Text style={[styles.aiText, !isConnected && { color: '#a1a1aa', fontStyle: 'normal' }]}>
                    &quot;{aiInsight}&quot;
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Enhanced Balance Card */}
            <LinearGradient colors={['#7c3aed', '#db2777']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.balanceCard}>
              <View>
                <Text style={styles.balanceLabel}>{t.net_worth}</Text>
                <Text style={styles.balanceValue}>{currencySymbol}{(currentBalance + owedToYou).toLocaleString()}</Text>
                {/* REMOVED "owedToYou > 0 &&" for testing */}
                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 5}}>
                  <ArrowUpRight size={14} color="#a7f3d0" />
                  <Text style={{color: '#a7f3d0', fontSize: 12, fontWeight: 'bold', marginLeft: 4}}>
                    + {currencySymbol}{owedToYou.toFixed(0)} owed to you
                  </Text>
                </View>
              </View>
              <View style={styles.glassIcon}><Wallet color="white" size={28} /></View>
            </LinearGradient>

            {/* SPENDING & BUDGETS */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                <Text style={styles.sectionTitle}>Monthly Targets 🎯</Text>
                <TouchableOpacity onPress={() => setShowBudgetModal(true)}>
                  <Text style={{color: THEME.accent, fontWeight: 'bold'}}>Edit Limits</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breakdownScroll}>
                {budgetStats.map(cat => (
                  <View key={cat.id} style={[styles.breakdownPill, {flexDirection: 'column', alignItems: 'flex-start', minWidth: 140, gap: 5}]}>
                    {/* Header: Icon & Amount */}
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
                       <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                         <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                         <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>{cat.label}</Text>
                       </View>
                       {cat.isBreached && <AlertCircle size={14} color={THEME.danger} />}
                    </View>

                    {/* Spend vs Limit Text */}
                    <Text style={{color: '#a1a1aa', fontSize: 11}}>
                      {currencySymbol}{cat.spent.toLocaleString()} <Text style={{opacity: 0.5}}>/ {cat.limit > 0 ? `${currencySymbol}${cat.limit}` : '∞'}</Text>
                    </Text>

                    {/* Progress Bar */}
                    {cat.limit > 0 && (
                      <View style={{width: '100%', height: 4, backgroundColor: '#27272a', borderRadius: 2, marginTop: 4}}>
                        <View style={{
                          width: `${Math.min(cat.percent, 100)}%`, 
                          height: '100%', 
                          backgroundColor: cat.isBreached ? THEME.danger : (cat.percent > 80 ? THEME.warning : THEME.success),
                          borderRadius: 2
                        }} />
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* --- 🌟 NEW: AFFILIATE CAROUSEL START --- */}
            <View style={styles.section}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                <Text style={styles.sectionTitle}>Grow Wealth 🚀</Text>
                <Text style={{color: THEME.subText, fontSize:10, textTransform:'uppercase', letterSpacing:1}}>Sponsored</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20}}>
                {AFFILIATE_OFFERS.map((offer) => (
                  <TouchableOpacity 
                    key={offer.id} 
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL(offer.link)}
                    style={{marginRight: 15}}
                  >
                    <LinearGradient 
                      colors={offer.color as [string, string]} 
                      start={{x:0, y:0}} end={{x:1, y:1}} 
                      style={styles.affiliateCard}
                    >
                      <View style={styles.affiliateIconBox}>
                         <ArrowUpRight color="white" size={20} />
                      </View>
                      <View style={{flex:1}}>
                        <Text style={styles.affiliateName}>{offer.name}</Text>
                        <Text style={styles.affiliateDesc}>{offer.desc}</Text>
                      </View>
                      <View style={styles.affiliateBtn}>
                        <Text style={styles.affiliateBtnText}>Open</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* --- 🌟 NEW: AFFILIATE CAROUSEL END --- */}

            {/* Transactions */}
            <View style={styles.section}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                <Text style={styles.sectionTitle}>{t.recent}</Text>
                <Text style={{color:'#71717a', fontSize:12}}>Tap to Edit • Hold to Delete</Text>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Coffee size={48} color={THEME.subText} />
                  <Text style={styles.emptyText}>No vibes yet. Go spend something.</Text>
                </View>
              ) : (
                transactions.map(tx => {
                  const cat = CATEGORIES.find(c => c.id === tx.category) || CATEGORIES[0];
                  return (
                    <TouchableOpacity 
                      key={tx.id} 
                      onPress={() => {/* handleEdit(tx) */}}
                      onLongPress={() => handleDelete(tx.id)} 
                      style={styles.txCard} 
                      activeOpacity={0.7}
                    >
                      <View style={styles.txLeft}>
                        <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                          <cat.icon size={20} color={cat.color} />
                        </View>
                        <View>
                          <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                            <Text style={styles.txTitle}>{tx.title}</Text>
                            {tx.isRecurring && <Repeat size={12} color={THEME.accent} />}
                          </View>
                          <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
                        </View>
                      </View>
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={styles.txAmt}>
                          {tx.type === 'income' ? `+${currencySymbol}${tx.amount}` : `-${currencySymbol}${tx.amount}`}
                        </Text>
                        <Edit2 size={12} color="#52525b" style={{marginTop: 4}} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        ) : (
          <InvestView t={t} riskProfile={riskProfile} setRiskProfile={setRiskProfile} />
        )}
      </ScrollView>

      {/* AdMob Banner */}
      {/*
      <View style={styles.adContainer}>
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : adUnitId} // use TestIds.BANNER during development
          size={BannerAdSize.BANNER} // CORRECT: use 'size' prop and a valid BannerAdSize
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
      */}

      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(tabs)/add')} style={styles.fabShadow}>
        <LinearGradient colors={['#22d3ee', '#3b82f6']} style={styles.fab}>
          <Plus color="black" size={32} />
        </LinearGradient>
      </TouchableOpacity>

      <AiChatModal 
        visible={showAiChat} 
        onClose={() => setShowAiChat(false)} 
        transactions={transactions} 
        isConnected={isConnected} 
        onGetRoast={callGemini} 
      />

      {/* NEW: Budget modal */}
      <BudgetModal
        visible={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        budgets={budgets}
        onSave={saveBudgets}
        currencySymbol={currencySymbol}
      />
    </View>
  );
}

const AiChatModal = ({ visible, onClose, transactions, isConnected, onGetRoast }: { visible: any; onClose: any; transactions: any; isConnected: any; onGetRoast: any; }): React.JSX.Element => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ id: 1, text: "Yo! I'm DhanVayu AI. Ask me about your spending or how to get rich.", isBot: true }]);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    try {
      if (!input.trim()) return;
      const userMsg = { id: Date.now(), text: input, isBot: false };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      if (!isConnected) {
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now() + 1, text: "🚫 I'm offline rn. Try again when you have signal.", isBot: true }]);
        }, 500);
        return;
      }
      setLoading(true);
      const txSummary = transactions.slice(0, 10).map((t: any) => `${t.title} (${t.amount})`).join(', ');
      const prompt = `You are a Gen-Z financial advisor. My recent transactions: ${txSummary}. User Question: "${userMsg.text}" Keep your answer short, helpful, and use emojis.`;
      const response = await onGetRoast(prompt);
      if (response) {
        setMessages(prev => [...prev, { id: Date.now() + 1, text: response, isBot: true }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now() + 1, text: "Error connecting to brain. 😵", isBot: true }]);
      }
    } catch (err) {
      console.error("handleSend error:", err);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: "Something broke. Try again later.", isBot: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.aiHeader}>
          <Text style={styles.chatTitle}>Ask DhanVayu 🤖</Text>
          <TouchableOpacity onPress={onClose}><X size={24} color="white" /></TouchableOpacity>
        </View>
        <ScrollView
          style={styles.chatBody}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(msg => (
            <View key={msg.id} style={[styles.msgBubble, msg.isBot ? styles.botBubble : styles.userBubble]}>
              <Text style={msg.isBot ? styles.btnText : styles.userText}>{msg.text}</Text>
            </View>
          ))}
          {loading && <ActivityIndicator color={THEME.accent} style={{ alignSelf: 'flex-start', marginLeft: 20 }} />}
        </ScrollView>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatInputArea}>
          <TextInput
            style={styles.chatInput}
            placeholder={isConnected ? "Ask anything..." : "Offline mode..."}
            placeholderTextColor="#71717a"
            value={input}
            onChangeText={setInput}
            editable={isConnected ? true : false} />
          <TouchableOpacity onPress={handleSend} style={[styles.sendBtn, !isConnected && { backgroundColor: '#3f3f46' }]} disabled={!isConnected}>
            <Send size={20} color={isConnected ? "white" : "#71717a"} />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const InvestView = ({ t, riskProfile, setRiskProfile }: { t: any, riskProfile: any, setRiskProfile: any }) => (
  <View style={styles.content}>
    <LinearGradient colors={['#059669', '#10b981']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.balanceCard}>
      <View>
        <Text style={styles.balanceLabel}>{t.invest_title}</Text>
        <Text style={styles.balanceValue}>Start w/ ₹500</Text>
      </View>
      <Shield color="white" size={32} />
    </LinearGradient>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.risk_profile}</Text>
      <View style={styles.riskRow}>
        {['conservative', 'moderate', 'aggressive'].map(m => (
          <TouchableOpacity key={m} onPress={() => setRiskProfile(m)} style={[styles.riskBtn, riskProfile === m && styles.riskBtnActive]}>
            <Text style={[styles.riskText, riskProfile === m && styles.riskTextActive]}>
              {m === 'conservative' ? '🐢 Chill' : m === 'moderate' ? '⚖️ Balanced' : '🚀 Yolo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
    <TouchableOpacity style={styles.affiliateBox} onPress={() => Linking.openURL('https://zerodha.com/open-account')} activeOpacity={0.8}>
      <LinearGradient colors={['#1e293b', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', width:'100%'}}>
        <View>
          <Text style={styles.affiliateTitle}>{t.start_investing}</Text>
          <Text style={styles.affiliateSub}>Open Demat & Get Rich</Text>
        </View>
        <View style={styles.arrowCircle}>
           <ArrowUpRight color="black" size={20} />
        </View>
      </View>
    </TouchableOpacity>
  </View>
);

const BudgetModal = ({ visible, onClose, budgets, onSave, currencySymbol }: { visible: boolean, onClose: () => void, budgets: any, onSave: (b: any) => void, currencySymbol: string }) => {
  const [localBudgets, setLocalBudgets] = useState(budgets);

  useEffect(() => {
    setLocalBudgets(budgets);
  }, [budgets]);

  const handleChange = (catId: string, val: string) => {
    setLocalBudgets((prev: any) => ({ ...prev, [catId]: parseFloat(val) || 0 }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { padding: 20 }]}>
        <View style={styles.aiHeader}>
          <Text style={styles.modalTitle}>Monthly Targets 🎯</Text>
          <TouchableOpacity onPress={onClose}><X size={24} color="white" /></TouchableOpacity>
        </View>
        <Text style={{color: '#a1a1aa', marginBottom: 20}}>Set your limits. We will roast you if you break them.</Text>
        
        <ScrollView showsVerticalScrollIndicator={false}>
          {CATEGORIES.map(cat => (
            <View key={cat.id} style={{marginBottom: 20}}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between'}}>
                <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
                  <View style={[styles.catIcon, {backgroundColor: cat.bg, width: 36, height: 36}]}>
                    <cat.icon size={18} color={cat.color} />
                  </View>
                  <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>{cat.label}</Text>
                </View>
                <TextInput 
                  placeholder={`${currencySymbol}0`}
                  placeholderTextColor="#52525b"
                  keyboardType="numeric"
                  style={{color: 'white', fontSize: 16, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#3f3f46', minWidth: 80, textAlign: 'right'}}
                  value={localBudgets[cat.id]?.toString()}
                  onChangeText={(t) => handleChange(cat.id, t)}
                />
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity onPress={() => onSave(localBudgets)} style={{marginBottom: 30}}>
          <LinearGradient colors={['#22d3ee', '#3b82f6']} style={styles.mainBtn}>
            <Text style={[styles.btnText, {color:'black'}]}>Save Budgets</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// 🤑 AFFILIATE LINKS DATA
const AFFILIATE_OFFERS = [
  {
    id: 'zerodha',
    name: 'Zerodha',
    desc: 'Free Equity Delivery',
    icon: 'kite', // placeholder — swap for an icon component or image
    color: ['#3b82f6', '#2563eb'], // Blue gradient
    link: 'https://zerodha.com/open-account?c=YOUR_ID' // REPLACE WITH YOUR LINK
  },
  {
    id: 'upstox',
    name: 'Upstox',
    desc: '₹0 Brokerage*',
    icon: 'up',
    color: ['#8b5cf6', '#6d28d9'], // Purple gradient
    link: 'https://upstox.com/open-account/?f=YOUR_ID' // REPLACE WITH YOUR LINK
  },
  {
    id: 'dhan', // <--- NEW ITEM
    name: 'Dhan',
    desc: 'Lightning Fast ⚡️',
    icon: 'target', 
    color: ['#14b8a6', '#0f766e'], // Teal/Green
    link: 'https://invite.dhan.co/?invite=YOUR_CODE'
  },
  {
    id: 'indmoney',
    name: 'INDmoney',
    desc: 'US Stocks @ $0',
    icon: 'us',
    color: ['#10b981', '#059669'], // Green gradient
    link: 'https://indmoney.onelink.me/YOUR_LINK' // REPLACE WITH YOUR LINK
  }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  offlineBanner: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, backgroundColor: THEME.danger, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, flexDirection: 'row', gap: 8, zIndex: 50 },
  offlineText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  greeting: { fontSize: 14, color: THEME.subText, fontWeight: '600' },
  username: { fontSize: 24, color: 'white', fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272a' },
  content: { padding: 20 },
  aiCard: { padding: 15, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiLabel: { color: THEME.accent, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  aiText: { color: 'white', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  balanceCard: { padding: 24, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, shadowColor: '#ec4899', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { color: 'white', fontSize: 36, fontWeight: '900', marginTop: 4 },
  glassIcon: { padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  breakdownScroll: { marginLeft: -5 },
  breakdownPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, marginRight: 10, borderWidth: 1, borderColor: '#27272a' },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  breakdownText: { color: THEME.text, fontSize: 13, marginRight: 5 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 15 },
  emptyState: { alignItems: 'center', padding: 40, opacity: 0.5 },
  emptyText: { color: 'white', marginTop: 10, fontSize: 14 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.card, padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  catIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontWeight: '700', color: 'white', fontSize: 16 },
  txDate: { fontSize: 12, color: '#71717a', marginTop: 2 },
  txAmt: { fontWeight: 'bold', fontSize: 16, color: THEME.text },
  //adBanner: { position: 'absolute', bottom: 90, left: 20, right: 20, height: 50, backgroundColor: '#18181b', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: '#3f3f46', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },

  // NEW: Ad container for BannerAd component
  //adContainer: {
   // alignItems: 'center',
    //justifyContent: 'center',
    //marginVertical: 20,
    //width: '100%',
    //minHeight: 50, // optional: reserve space while loading
  //},
  fab: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  fabShadow: { position: 'absolute', bottom: 150, right: 20, shadowColor: '#22d3ee', shadowOpacity: 0.5, elevation: 10, shadowRadius: 15 },
  floatingNavWrapper: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  floatingNav: { flexDirection: 'row', backgroundColor: 'rgba(24, 24, 27, 0.9)', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 40, gap: 10, borderWidth: 1, borderColor: '#3f3f46', alignItems: 'center' },
  navItem: { padding: 10 },
  navDivider: { width: 1, height: 20, backgroundColor: '#3f3f46', marginHorizontal: 10 },
  authContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  authContent: { padding: 20 },
  glassCard: { backgroundColor: 'rgba(24, 24, 27, 0.7)', padding: 30, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  logoGlow: { alignSelf: 'center', backgroundColor: 'rgba(217, 70, 239, 0.1)', padding: 20, borderRadius: 50, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(217, 70, 239, 0.3)' },
  authTitle: { fontSize: 32, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 8 },
  authSub: { color: '#a1a1aa', textAlign: 'center', marginBottom: 30 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 20 },
  googleBtnText: { color: 'black', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#3f3f46' },
  orText: { color: '#71717a', marginHorizontal: 10, fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: '#27272a', borderRadius: 16, marginBottom: 16, padding: 18, color: 'white', fontSize: 16, borderWidth: 1, borderColor: '#3f3f46' },
  mainBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#d946ef', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#18181b', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: '#3f3f46' },
  modalIndicator: { width: 40, height: 4, backgroundColor: '#3f3f46', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
  inputDark: { backgroundColor: '#09090b', color: 'white', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272a', fontSize: 16 },
  inputError: { borderColor: THEME.danger, backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 4 },
  errorText: { color: THEME.danger, fontSize: 12, fontWeight: '600' },
  catLabel: { color: '#a1a1aa', marginBottom: 12, fontWeight: '600', marginTop: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  catOption: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#27272a', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#09090b' },
  catOptionActive: { backgroundColor: 'white', borderColor: 'white' },
  catText: { fontWeight: '600', color: '#a1a1aa' },
  lockContainer: { flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center', padding: 20 },
  lockIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(217, 70, 239, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(217, 70, 239, 0.3)' },
  lockTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  lockSub: { color: '#a1a1aa', marginBottom: 40, textAlign: 'center' },
  pinDots: { flexDirection: 'row', gap: 20, marginBottom: 40 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46' },
  dotActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: '80%', gap: 20, justifyContent: 'center' },
  key: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272a' },
  keyText: { fontSize: 28, color: 'white', fontWeight: 'bold' },
  recurringBox: { backgroundColor: '#18181b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a', marginBottom: 20 },
  freqChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46', backgroundColor: '#09090b' },
  freqChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  freqText: { fontSize: 12, color: '#71717a', fontWeight: '600' },
  
  // AI CHAT MODAL STYLES
  chatTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  chatBody: { flex: 1, backgroundColor: THEME.bg },
  chatInputArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#27272a', backgroundColor: THEME.card },
  chatInput: { flex: 1, backgroundColor: '#27272a', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: THEME.text, marginRight: 8 },
  sendBtn: { backgroundColor: THEME.primary, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  msgBubble: { padding: 12, borderRadius: 16, marginBottom: 10, maxWidth: '80%' },
  botBubble: { backgroundColor: '#27272a', alignSelf: 'flex-start' },
  userBubble: { backgroundColor: THEME.primary, alignSelf: 'flex-end' },
  userText: { color: 'white', fontSize: 14 },
  
  // INVEST VIEW STYLES
  riskRow: { flexDirection: 'row', gap: 10 },
  riskBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#27272a', alignItems: 'center', backgroundColor: '#09090b' },
  riskBtnActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  riskText: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },
    riskTextActive: { color: 'white' },
    affiliateBox: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#27272a',
      backgroundColor: '#0b1220',
      marginBottom: 20,
      overflow: 'hidden'
    },
    affiliateTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
    affiliateSub: { color: '#a1a1aa', fontSize: 12 },
    arrowCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
    affiliateCard: {
      // Dynamic Width: Takes up ~42% of screen width (fits 2 cards + peek of 3rd)
      width: SCREEN_WIDTH * 0.42,
      height: 180,
      borderRadius: 24,
      padding: 16,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    affiliateIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    affiliateName: { color: 'white', fontWeight: '700', fontSize: 14 },
    affiliateDesc: { color: '#a1a1aa', fontSize:  12 },
    affiliateBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    affiliateBtnText: { color: 'white', fontWeight: '700' },
    inlineAd: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#18181b',
      padding: 12,
      borderRadius: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#3f3f46',
      borderStyle: 'dashed', // Differentiate ads
    },
});