/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import {
    AlertCircle,
    Calendar,
    Car,
    Coffee,
    Film,
    ShoppingBag,
    Smartphone,
    Zap
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useUser } from '../../context/UserContext';
import { auth, db } from '../../firebaseConfig';
// Security Services
import { validateTransaction, sanitizeForDatabase } from '../../services/validation';
import { RateLimitService } from '../../services/rateLimit';

// --- THEME & CONSTANTS (Matching index.tsx) ---
const THEME = {
  bg: '#09090b',
  card: '#18181b',
  text: '#fafafa',
  subText: '#a1a1aa',
  primary: '#8b5cf6',
  accent: '#d946ef',
  success: '#10b981',
  danger: '#ef4444',
  input: '#27272a',
};

const CATEGORIES = [
  { id: 'food', label: 'Munchies', icon: Coffee, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'transport', label: 'Commute', icon: Car, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  { id: 'shopping', label: 'Drip', icon: ShoppingBag, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  { id: 'tech', label: 'Tech', icon: Smartphone, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  { id: 'bills', label: 'Bills', icon: Zap, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  { id: 'fun', label: 'Vibes', icon: Film, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
];

const getNextDueDate = (dateStr: string, frequency: string) => {
  const date = new Date(dateStr);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
};

export default function AddScreen() {
  const router = useRouter();
  const { symbol: currencySymbol } = useUser();
  const user = auth.currentUser;

  // --- FORM STATE ---
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ title: '', amount: '' });

  // Reset form when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [])
  );

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('food');
    setTxType('expense');
    setIsRecurring(false);
    setFrequency('monthly');
    setErrors({ title: '', amount: '' });
    setLoading(false);
  };

  const validate = () => {
    // Use comprehensive validation service
    const validation = validateTransaction({
      title,
      amount: parseFloat(amount) || 0,
      category: txType === 'income' ? 'income' : category,
      type: txType,
      isRecurring,
    });

    if (!validation.isValid) {
      const newErrors = { title: '', amount: '' };
      
      // Map validation errors to form fields
      validation.errors.forEach(err => {
        if (err.includes('title') || err.includes('Title')) {
          newErrors.title = err;
        } else if (err.includes('amount') || err.includes('Amount')) {
          newErrors.amount = err;
        }
      });
      
      setErrors(newErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }

    setErrors({ title: '', amount: '' });
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!user) return Alert.alert("Error", "You must be logged in.");

    // Check rate limit for transaction creation
    const rateLimitCheck = await RateLimitService.checkRateLimit(
      'TRANSACTION_CREATE',
      user.uid
    );
    
    if (!rateLimitCheck.allowed) {
      const waitMins = Math.ceil((rateLimitCheck.waitTimeMs || 60000) / 60000);
      Alert.alert(
        "Slow Down! 🐌",
        `You're adding transactions too fast. Try again in ${waitMins} minute(s).`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    const amountVal = parseFloat(amount);

    // Build transaction data
    const txData: Record<string, any> = {
      title: sanitizeForDatabase(title),
      amount: amountVal,
      category: txType === 'income' ? 'income' : category,
      type: txType,
      isRecurring,
      frequency,
      date: new Date().toISOString()
    };

    if (isRecurring) {
      txData.nextTriggerDate = getNextDueDate(new Date().toISOString(), frequency);
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'expenses'), txData);
      
      // Success feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      router.push('/(tabs)'); 
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[THEME.bg, '#18181b']} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle}>Add Transaction</Text>

          {/* TYPE TOGGLE */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              onPress={() => setTxType('expense')}
              style={[styles.toggleBtn, { backgroundColor: txType === 'expense' ? THEME.danger : 'transparent' }]}
            >
              <Text style={[styles.toggleText, { color: txType === 'expense' ? 'white' : '#71717a' }]}>Expense 💸</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setTxType('income')}
              style={[styles.toggleBtn, { backgroundColor: txType === 'income' ? THEME.success : 'transparent' }]}
            >
              <Text style={[styles.toggleText, { color: txType === 'income' ? 'white' : '#71717a' }]}>Income 💰</Text>
            </TouchableOpacity>
          </View>

          {/* TITLE INPUT */}
          <View style={styles.inputGroup}>
            <TextInput 
              placeholder={txType === 'income' ? "Salary, Freelance, Gift..." : "What did you buy?"}
              placeholderTextColor="#52525b" 
              style={[styles.input, errors.title ? styles.inputError : null]} 
              value={title} 
              onChangeText={(t) => { setTitle(t); if(errors.title) setErrors({...errors, title: ''}) }} 
            />
            {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
          </View>

          {/* AMOUNT INPUT */}
          <View style={styles.inputGroup}>
            <TextInput 
              placeholder={`Amount (${currencySymbol})`} 
              placeholderTextColor="#52525b" 
              keyboardType="numeric" 
              style={[styles.input, styles.amountInput, errors.amount ? styles.inputError : null]} 
              value={amount} 
              onChangeText={(t) => { setAmount(t); if(errors.amount) setErrors({...errors, amount: ''}) }} 
            />
            {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
          </View>

          {/* RECURRING OPTIONS */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowStart}>
                <Calendar size={18} color={THEME.primary} />
                <Text style={styles.cardLabel}>Repeat Transaction?</Text>
              </View>
              <Switch 
                value={isRecurring} 
                onValueChange={setIsRecurring}
                trackColor={{false: '#27272a', true: 'rgba(139, 92, 246, 0.3)'}}
                thumbColor={isRecurring ? THEME.primary : '#52525b'}
              />
            </View>
            
            {isRecurring && (
              <View style={styles.freqRow}>
                {['weekly', 'monthly', 'yearly'].map((freq) => (
                  <TouchableOpacity 
                    key={freq} 
                    onPress={() => setFrequency(freq)}
                    style={[styles.freqChip, frequency === freq && styles.freqChipActive]}
                  >
                    <Text style={[styles.freqText, frequency === freq && { color: 'white' }]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* CATEGORIES (Only for Expense) */}
          {txType === 'expense' && (
            <>
              <Text style={styles.sectionLabel}>Vibe Check</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    onPress={() => setCategory(cat.id)} 
                    style={[styles.catOption, category === cat.id && styles.catOptionActive]}
                  >
                    <cat.icon size={24} color={category === cat.id ? 'black' : cat.color} />
                    <Text style={[styles.catText, category === cat.id && {color: 'black'}]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* SPACER FOR TAB BAR */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* SUBMIT BUTTON */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            <LinearGradient 
              colors={txType === 'income' ? ['#10b981', '#059669'] : ['#8b5cf6', '#d946ef']} 
              style={styles.saveBtn}
              start={{x:0, y:0}} end={{x:1, y:1}}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveBtnText}>Save Transaction</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: 'white', marginBottom: 25, textAlign: 'center' },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: '#27272a', padding: 4, borderRadius: 16, marginBottom: 25 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  toggleText: { fontWeight: 'bold', fontSize: 14 },

  inputGroup: { marginBottom: 15 },
  input: { backgroundColor: THEME.input, color: 'white', padding: 18, borderRadius: 16, fontSize: 16, borderWidth: 1, borderColor: '#3f3f46' },
  amountInput: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  inputError: { borderColor: THEME.danger, backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  errorText: { color: THEME.danger, fontSize: 12, marginTop: 6, marginLeft: 4 },

  card: { backgroundColor: '#18181b', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#27272a', marginBottom: 25 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { color: 'white', fontWeight: '600', fontSize: 16 },
  
  freqRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  freqChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46', backgroundColor: '#09090b' },
  freqChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  freqText: { fontSize: 13, color: '#71717a', fontWeight: '600' },

  sectionLabel: { color: '#a1a1aa', marginBottom: 15, fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catOption: { width: '30%', aspectRatio: 1, borderRadius: 20, borderWidth: 1, borderColor: '#27272a', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#09090b' },
  catOptionActive: { backgroundColor: 'white', borderColor: 'white' },
  catText: { fontWeight: '600', color: '#a1a1aa', fontSize: 12 },

  footer: { position: 'absolute', bottom: 100, left: 20, right: 20 },
  saveBtn: { padding: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#8b5cf6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18, textTransform: 'uppercase', letterSpacing: 1 },
});