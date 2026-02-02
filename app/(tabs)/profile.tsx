/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { deleteUser, signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  Bell,
  Check, ChevronDown,
  ChevronRight,
  Delete,
  DollarSign,
  FileText,
  Fingerprint,
  Key,
  Lock,
  LogOut,
  Megaphone,
  Save, Shield,
  Trash2,
  User
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { SecurePinService } from '../../services/secureStorage';
// Security & Validation Services
import { validateDisplayName, sanitizeString } from '../../services/validation';
// IMPORT THE HOOK
import { useUser } from '../../context/UserContext';

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
  border: '#3f3f46',
};

const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
];

export default function ProfileScreen() {
  const user = auth.currentUser;
  const router = useRouter();
  
  // USE GLOBAL CONTEXT
  const { currency, setCurrency } = useUser();

  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [notifications, setNotifications] = useState(true);
  
  // PIN & Security State
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [pinStep, setPinStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  
  // Dropdown State
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // Load security settings
  useEffect(() => {
    loadSecuritySettings();
  }, []);

  const loadSecuritySettings = async () => {
    const isPinSetup = await SecurePinService.isPinSetup();
    const isPinEn = await SecurePinService.isPinEnabled();
    const isBioEn = await SecurePinService.isBiometricEnabled();
    
    setPinEnabled(isPinSetup && isPinEn);
    setBiometricEnabled(isBioEn);
    
    // Check if device has biometrics
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setHasBiometrics(hasHardware && isEnrolled);
  };

  // Load ONLY non-global settings locally (like notifications)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'settings', 'preferences'), (snap) => {
      if (snap.exists()) {
        setNotifications(snap.data().notificationsEnabled ?? true);
      }
    });
    return unsub;
  }, [user]);

  const updateSetting = async (field: string, value: any) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), { [field]: value }).catch(() => {});
  };

  const handleTogglePinLock = async (enabled: boolean) => {
    if (enabled) {
      // Check if PIN is already set up
      const isPinSetup = await SecurePinService.isPinSetup();
      if (!isPinSetup) {
        // Need to set up PIN first - show change PIN modal in setup mode
        setShowChangePinModal(true);
        setPinStep('new');
      } else {
        await SecurePinService.setPinEnabled(true);
        setPinEnabled(true);
      }
    } else {
      // Disable PIN - require current PIN verification
      setShowChangePinModal(true);
      setPinStep('current');
    }
  };

  const handleToggleBiometric = async (enabled: boolean) => {
    await SecurePinService.setBiometricEnabled(enabled);
    setBiometricEnabled(enabled);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePinKeyPress = async (val: string) => {
    if (pinLoading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPinError('');

    if (val === 'del') {
      if (pinStep === 'current') setCurrentPinInput(p => p.slice(0, -1));
      else if (pinStep === 'new') setNewPinInput(p => p.slice(0, -1));
      else setConfirmPinInput(p => p.slice(0, -1));
      return;
    }

    if (pinStep === 'current') {
      const newVal = currentPinInput + val;
      setCurrentPinInput(newVal);
      if (newVal.length === 4) {
        setPinLoading(true);
        const result = await SecurePinService.verifyPin(newVal);
        if (result.success) {
          // If we were disabling, just disable and close
          if (!pinEnabled) {
            setPinStep('new');
          } else {
            // Disabling PIN lock
            await SecurePinService.setPinEnabled(false);
            setPinEnabled(false);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            closePinModal();
          }
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPinError(result.error || 'Incorrect PIN');
          setCurrentPinInput('');
        }
        setPinLoading(false);
      }
    } else if (pinStep === 'new') {
      const newVal = newPinInput + val;
      setNewPinInput(newVal);
      if (newVal.length === 4) {
        // Check for weak PIN
        const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '3210'];
        if (weakPins.includes(newVal)) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setPinError('PIN is too weak. Try a different one.');
          setNewPinInput('');
        } else {
          setPinStep('confirm');
        }
      }
    } else {
      const newVal = confirmPinInput + val;
      setConfirmPinInput(newVal);
      if (newVal.length === 4) {
        if (newVal === newPinInput) {
          setPinLoading(true);
          const result = await SecurePinService.setupPin(newPinInput);
          if (result.success) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPinEnabled(true);
            Alert.alert('Success', 'PIN has been updated securely!');
            closePinModal();
          } else {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setPinError(result.error || 'Failed to save PIN');
          }
          setPinLoading(false);
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPinError('PINs do not match. Try again.');
          setNewPinInput('');
          setConfirmPinInput('');
          setPinStep('new');
        }
      }
    }
  };

  const closePinModal = () => {
    setShowChangePinModal(false);
    setPinStep('current');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinError('');
    setPinLoading(false);
  };

  const handleOpenLink = async (url: string) => {
    try { await WebBrowser.openBrowserAsync(url); } catch (e) { Alert.alert("Error", "Could not open link"); }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    // Validate display name
    const nameValidation = validateDisplayName(displayName);
    if (!nameValidation.isValid) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid Name", nameValidation.error || "Please enter a valid name");
      return;
    }
    
    // Sanitize the name
    const sanitizedName = nameValidation.sanitizedValue || sanitizeString(displayName);
    
    setLoading(true);
    try {
      await updateProfile(user, { displayName: sanitizedName });
      setDisplayName(sanitizedName);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile updated!");
    } catch (e) { 
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", (e as Error).message); 
    }
    setLoading(false);
  };

  const handleLogout = async () => { await signOut(auth); };
  
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account?",
      "This is permanent. All your data will be wiped.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Forever", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            try {
              await deleteUser(user!);
            } catch (e: any) {
              if (e.code === 'auth/requires-recent-login') {
                Alert.alert('Security Check', 'Please re-login to delete your account. You can sign out and login again, then retry deletion.');
              } else {
                Alert.alert("Error", e.message || 'Failed to delete account');
              }
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getCurrentPinDisplay = () => {
    if (pinStep === 'current') return currentPinInput;
    if (pinStep === 'new') return newPinInput;
    return confirmPinInput;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[THEME.bg, '#1e1b4b']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* PROFILE CARD */}
        <View style={styles.card}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.email?.[0].toUpperCase()}</Text>
            </View>
            <View>
               <Text style={styles.emailText}>{user?.email}</Text>
               {/* ID removed for privacy */}
            </View>
          </View>
          
          <View style={styles.inputRow}>
            <User size={20} color={THEME.subText} />
            <TextInput 
              style={styles.input} value={displayName} onChangeText={setDisplayName} 
              placeholder="Display Name" placeholderTextColor="#52525b"
            />
            <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
              <Save size={20} color={THEME.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* AD BANNER */}
        <TouchableOpacity
          style={styles.adBanner}
          onPress={() => handleOpenLink('https://your-ad-link.example.com')}
          activeOpacity={0.85}
        >
          <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
            <Megaphone size={20} color="#fbbf24" />
            <View>
              <Text style={{color:'white', fontWeight:'bold'}}>Upgrade to Pro</Text>
              <Text style={{color:'#a1a1aa', fontSize:11}}>Remove ads & unlock themes</Text>
            </View>
          </View>
          <ChevronRight size={16} color="#71717a" />
        </TouchableOpacity>

        {/* SETTINGS SECTION */}
        <Text style={styles.sectionTitle}>App Settings</Text>
        
        <View style={styles.card}>
          {/* Notifications */}
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                <Bell size={20} color="#eab308" />
              </View>
              <Text style={styles.settingLabel}>Push Notifications</Text>
            </View>
            <Switch 
              value={notifications} 
              onValueChange={(val) => { setNotifications(val); updateSetting('notificationsEnabled', val); }}
              trackColor={{ false: '#27272a', true: THEME.primary }}
            />
          </View>

          <View style={styles.divider} />

          {/* CURRENCY DROPDOWN TRIGGER */}
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowCurrencyModal(true)}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <DollarSign size={20} color="#22c55e" />
              </View>
              <Text style={styles.settingLabel}>Currency</Text>
            </View>
            
            <View style={styles.dropdownTrigger}>
              <Text style={styles.dropdownText}>{currency}</Text>
              <ChevronDown size={16} color={THEME.subText} />
            </View>
          </TouchableOpacity>
        </View>

        {/* SECURITY SECTION */}
        <Text style={styles.sectionTitle}>Security</Text>
        
        <View style={styles.card}>
          {/* PIN Lock Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Lock size={20} color={THEME.primary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>PIN Lock</Text>
                <Text style={styles.settingSub}>Require PIN when opening app</Text>
              </View>
            </View>
            <Switch 
              value={pinEnabled} 
              onValueChange={handleTogglePinLock}
              trackColor={{ false: '#27272a', true: THEME.primary }}
            />
          </View>

          {pinEnabled && (
            <>
              <View style={styles.divider} />
              
              {/* Change PIN */}
              <TouchableOpacity 
                style={styles.settingRow} 
                onPress={() => { setShowChangePinModal(true); setPinStep('current'); }}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(217, 70, 239, 0.15)' }]}>
                    <Key size={20} color={THEME.accent} />
                  </View>
                  <Text style={styles.settingLabel}>Change PIN</Text>
                </View>
                <ChevronRight size={16} color={THEME.subText} />
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Biometric Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Fingerprint size={20} color={THEME.success} />
                  </View>
                  <View>
                    <Text style={styles.settingLabel}>Biometric Unlock</Text>
                    <Text style={styles.settingSub}>
                      {hasBiometrics ? 'Use fingerprint/face to unlock' : 'Not available on this device'}
                    </Text>
                  </View>
                </View>
                <Switch 
                  value={biometricEnabled && hasBiometrics} 
                  onValueChange={handleToggleBiometric}
                  disabled={!hasBiometrics}
                  trackColor={{ false: '#27272a', true: THEME.success }}
                />
              </View>
            </>
          )}
        </View>

        {/* LEGAL SECTION */}
        <Text style={styles.sectionTitle}>Legal & About</Text>
        <View style={styles.card}>
          
          {/* Privacy Policy */}
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={() => handleOpenLink('https://sites.google.com/view/dhanvayu/privacy-policy')}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}> 
                <Shield size={20} color="#3b82f6" />
              </View>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <ChevronRight size={16} color={THEME.subText} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Terms of Service */}
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={() => handleOpenLink('https://sites.google.com/view/dhanvayu/terms-of-service')}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <FileText size={20} color="#a855f7" />
              </View>
              <Text style={styles.settingLabel}>Terms of Service</Text>
            </View>
            <ChevronRight size={16} color={THEME.subText} />
          </TouchableOpacity>
        </View>

        {/* DANGER ZONE */}
        <Text style={[styles.sectionTitle, { color: THEME.danger }]}>Danger Zone</Text>
        <View style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Trash2 size={20} color={THEME.danger} />
              </View>
              <Text style={[styles.settingLabel, { color: THEME.danger }]}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color={THEME.subText} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.3 (Build 46)</Text>
      </ScrollView>

      {/* PIN CHANGE/SETUP MODAL */}
      <Modal visible={showChangePinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 30 }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closePinModal}>
              <Text style={{ color: THEME.subText }}>Cancel</Text>
            </TouchableOpacity>
            
            <View style={styles.pinModalIcon}>
              {pinStep === 'current' ? (
                <Lock size={32} color={THEME.primary} />
              ) : pinStep === 'new' ? (
                <Key size={32} color={THEME.accent} />
              ) : (
                <Shield size={32} color={THEME.success} />
              )}
            </View>
            
            <Text style={styles.pinModalTitle}>
              {pinStep === 'current' ? 'Enter Current PIN' : 
               pinStep === 'new' ? 'Enter New PIN' : 'Confirm New PIN'}
            </Text>
            <Text style={styles.pinModalSub}>
              {pinStep === 'current' ? 'Verify your identity' : 
               pinStep === 'new' ? 'Choose a strong 4-digit PIN' : 'Re-enter to confirm'}
            </Text>

            {pinError ? (
              <View style={styles.pinErrorBox}>
                <AlertCircle size={14} color={THEME.danger} />
                <Text style={styles.pinErrorText}>{pinError}</Text>
              </View>
            ) : null}

            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map(i => (
                <View 
                  key={i} 
                  style={[
                    styles.pinDot, 
                    getCurrentPinDisplay().length > i && styles.pinDotActive,
                    pinLoading && styles.pinDotLoading
                  ]} 
                />
              ))}
            </View>

            <View style={styles.pinKeypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <TouchableOpacity 
                  key={n} 
                  onPress={() => handlePinKeyPress(n.toString())} 
                  style={styles.pinKey}
                  disabled={pinLoading}
                >
                  <Text style={styles.pinKeyText}>{n}</Text>
                </TouchableOpacity>
              ))}
              <View style={[styles.pinKey, { backgroundColor: 'transparent', borderWidth: 0 }]} />
              <TouchableOpacity 
                onPress={() => handlePinKeyPress('0')} 
                style={styles.pinKey}
                disabled={pinLoading}
              >
                <Text style={styles.pinKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handlePinKeyPress('del')} 
                style={styles.pinKey}
                disabled={pinLoading}
              >
                <Delete size={20} color={THEME.danger} />
              </TouchableOpacity>
            </View>

            {pinLoading && <ActivityIndicator color={THEME.accent} style={{ marginTop: 15 }} />}
          </View>
        </View>
      </Modal>

      {/* CURRENCY SELECTION MODAL */}
      <Modal visible={showCurrencyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Text style={{color: THEME.subText}}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={CURRENCIES}
              keyExtractor={(item) => item.code}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={[styles.currencyOption, currency === item.code && styles.currencyOptionActive]}
                  onPress={() => {
                    setCurrency(item.code as any);
                    setShowCurrencyModal(false);
                  }}
                >
                  <View style={{flexDirection:'row', gap: 10, alignItems:'center'}}>
                    <View style={styles.currencyIcon}>
                      <Text style={{color: 'white', fontWeight:'bold'}}>{item.symbol}</Text>
                    </View>
                    <View>
                      <Text style={styles.optionCode}>{item.code}</Text>
                      <Text style={styles.optionLabel}>{item.label}</Text>
                    </View>
                  </View>
                  {currency === item.code && <Check size={20} color={THEME.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: 'white' },
  content: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: THEME.card, borderRadius: 20, padding: 16, marginBottom: 25, borderWidth: 1, borderColor: THEME.border },
  avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  emailText: { color: 'white', fontSize: 16, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, gap: 10 },
  input: { flex: 1, color: 'white', fontSize: 16 },
  sectionTitle: { color: THEME.subText, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { color: 'white', fontSize: 16, fontWeight: '500' },
  settingSub: { color: THEME.subText, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },
  
  // Dropdown Styles
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#27272a', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  dropdownText: { color: 'white', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: THEME.card, borderRadius: 24, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: THEME.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  modalCloseBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
  currencyOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  currencyOptionActive: { backgroundColor: 'rgba(139, 92, 246, 0.1)', marginHorizontal: -10, paddingHorizontal: 10, borderRadius: 12, borderBottomColor: 'transparent' },
  currencyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  optionCode: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  optionLabel: { color: THEME.subText, fontSize: 12 },
  
  // PIN Modal Styles
  pinModalIcon: { 
    backgroundColor: 'rgba(139, 92, 246, 0.1)', 
    padding: 16, 
    borderRadius: 50, 
    marginBottom: 15 
  },
  pinModalTitle: { 
    color: 'white', 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 5 
  },
  pinModalSub: { 
    color: THEME.subText, 
    fontSize: 14, 
    marginBottom: 10 
  },
  pinErrorBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
    padding: 10, 
    borderRadius: 10, 
    marginBottom: 10 
  },
  pinErrorText: { 
    color: THEME.danger, 
    fontSize: 13 
  },
  pinDots: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 20 
  },
  pinDot: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#27272a', 
    borderWidth: 1, 
    borderColor: '#3f3f46' 
  },
  pinDotActive: { 
    backgroundColor: THEME.accent 
  },
  pinDotLoading: { 
    backgroundColor: THEME.warning 
  },
  pinKeypad: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    width: 240, 
    gap: 15, 
    justifyContent: 'center' 
  },
  pinKey: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#18181b', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#27272a' 
  },
  pinKeyText: { 
    fontSize: 22, 
    color: 'white', 
    fontWeight: 'bold' 
  },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 16, borderRadius: 16, backgroundColor: '#27272a' },
  logoutText: { color: 'white', fontWeight: 'bold' },
  version: { textAlign: 'center', color: '#52525b', marginTop: 30, fontSize: 12 },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  adBanner: {
    backgroundColor: '#27272a',
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});