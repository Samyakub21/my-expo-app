/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack } from 'expo-router';
import {
  auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
} from '../firebaseConfig';
import { AlertCircle, Delete, Fingerprint, Lock, Shield, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import OnboardingScreen from '../components/OnboardingScreen';
import { UserProvider } from '../context/UserContext';

import { SecurePinService } from '../services/secureStorage';
// Security Services
import { validateEmail, validatePassword, sanitizeString } from '../services/validation';
import { RateLimitService } from '../services/rateLimit';

// --- CONSTANTS ---
const THEME = {
  bg: '#09090b',
  primary: '#8b5cf6',
  accent: '#d946ef',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

// --- AUTH SCREEN COMPONENT ---
const AuthScreen = ({ onLogin }: { onLogin: any }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: makeRedirectUri({ scheme: 'dhanvayu' }), 
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential).catch((e) => {
        Alert.alert("Login Failed", e.message);
        setLoading(false);
      });
    }
  }, [response]);

  const validateInputs = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || 'Invalid email');
      isValid = false;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || 'Invalid password');
      isValid = false;
    }

    return isValid;
  };

  const handleAuth = async () => {
    // Validate inputs first
    if (!validateInputs()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Check rate limit
    const limitType = isLogin ? 'LOGIN_ATTEMPT' : 'SIGNUP_ATTEMPT';
    const rateLimitCheck = await RateLimitService.checkRateLimit(limitType, email);
    
    if (!rateLimitCheck.allowed) {
      const waitMins = Math.ceil((rateLimitCheck.waitTimeMs || 60000) / 60000);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Too Many Attempts 🔒",
        `Please wait ${waitMins} minute(s) before trying again.`
      );
      return;
    }

    setLoading(true);
    try {
      // Sanitize email before sending
      const sanitizedEmail = sanitizeString(email).toLowerCase();
      
      if (isLogin) {
        await signInWithEmailAndPassword(auth, sanitizedEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { 
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // User-friendly error messages
      let errorMessage = e.message;
      if (e.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email.";
      } else if (e.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Try again.";
      } else if (e.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered.";
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
      } else if (e.code === 'auth/weak-password') {
        errorMessage = "Password should be at least 6 characters.";
      }
      
      Alert.alert("Error", errorMessage); 
      setLoading(false); 
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2e1065', '#09090b']} style={StyleSheet.absoluteFill} />
      <View style={styles.authContent}>
        <View style={styles.glassCard}>
          <View style={styles.logoGlow}><Sparkles size={32} color={THEME.accent} fill={THEME.accent} /></View>
          <Text style={styles.authTitle}>{isLogin ? "Welcome Back" : "Join the Squad"}</Text>
          
          <TouchableOpacity style={styles.googleBtn} disabled={!request} onPress={() => promptAsync()}>
            <Text style={styles.googleBtnText}>G  Continue with Google</Text>
          </TouchableOpacity>

          <Text style={{textAlign:'center', color:'#52525b', marginVertical:10}}>OR</Text>
          
          <TextInput 
            style={[styles.input, emailError ? styles.inputError : null]} 
            placeholder="Email" 
            placeholderTextColor="#52525b"
            value={email} 
            onChangeText={(t) => { setEmail(t); setEmailError(''); }} 
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          
          <TextInput 
            style={[styles.input, passwordError ? styles.inputError : null]} 
            placeholder="Password" 
            placeholderTextColor="#52525b"
            value={password} 
            onChangeText={(t) => { setPassword(t); setPasswordError(''); }} 
            secureTextEntry 
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          
          <TouchableOpacity onPress={handleAuth} disabled={loading}>
            <LinearGradient colors={['#d946ef', '#8b5cf6']} style={styles.mainBtn}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{isLogin ? "Let's Go" : "Sign Up"}</Text>}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{marginTop: 20}}>
            <Text style={{color: THEME.accent, textAlign: 'center'}}>{isLogin ? "Create Account" : "Login instead"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- LOCK SCREEN COMPONENT (Secure) ---
const LockScreen = ({ onUnlock, onSetupPin }: { onUnlock: () => void; onSetupPin?: () => void }) => {
  const [pin, setPin] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<Date | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  useEffect(() => { 
    initializeLockScreen();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutTime) return;
    const interval = setInterval(() => {
      if (new Date() >= lockoutTime) {
        setIsLocked(false);
        setLockoutTime(null);
        setAttemptsRemaining(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  const initializeLockScreen = async () => {
    // Check lockout status
    const lockoutStatus = await SecurePinService.getLockoutStatus();
    if (lockoutStatus.isLocked && lockoutStatus.lockedUntil) {
      setIsLocked(true);
      setLockoutTime(lockoutStatus.lockedUntil);
    }

    // Check biometrics
    const bioEnabled = await SecurePinService.isBiometricEnabled();
    setBiometricEnabled(bioEnabled);
    
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const canUseBio = hasHardware && isEnrolled && bioEnabled;
    setHasBiometrics(canUseBio);
    
    if (canUseBio && !lockoutStatus.isLocked) {
      promptBiometrics();
    }
  };

  const promptBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({ 
        promptMessage: 'Unlock DhanVayu',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      }
    } catch (error) {
      console.log('Biometric error:', error);
    }
  };

  const handlePress = async (val: string) => {
    if (isLocked || verifying) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (val === 'del') { 
      setPin(p => p.slice(0, -1)); 
      return; 
    }
    
    const newPin = pin + val;
    setPin(newPin);
    
    if (newPin.length === 4) {
      setVerifying(true);
      const result = await SecurePinService.verifyPin(newPin);
      
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPin('');
        
        if (result.lockedUntil) {
          setIsLocked(true);
          setLockoutTime(result.lockedUntil);
        } else if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining);
        }
      }
      setVerifying(false);
    }
  };

  const formatLockoutTime = () => {
    if (!lockoutTime) return '';
    const diff = Math.max(0, Math.floor((lockoutTime.getTime() - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#09090b', '#2e1065']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.lockIconContainer}>
        <Lock size={40} color={isLocked ? THEME.danger : THEME.accent} />
      </View>
      <Text style={styles.authTitle}>{isLocked ? 'Locked Out' : 'Locked'}</Text>
      
      {isLocked ? (
        <View style={styles.lockoutContainer}>
          <AlertCircle size={24} color={THEME.warning} />
          <Text style={styles.lockoutText}>Too many failed attempts</Text>
          <Text style={styles.lockoutTimer}>Try again in {formatLockoutTime()}</Text>
        </View>
      ) : (
        <>
          {attemptsRemaining !== null && attemptsRemaining < 5 && (
            <Text style={styles.attemptsText}>
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
            </Text>
          )}
          
          <View style={styles.pinDotsContainer}>
            {[0, 1, 2, 3].map(i => (
              <View 
                key={i} 
                style={[
                  styles.dot, 
                  pin.length > i && styles.dotActive,
                  verifying && styles.dotVerifying
                ]} 
              />
            ))}
          </View>

          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <TouchableOpacity 
                key={n} 
                onPress={() => handlePress(n.toString())} 
                style={styles.key}
                disabled={verifying}
              >
                <Text style={styles.keyText}>{n}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              onPress={() => hasBiometrics ? promptBiometrics() : null} 
              style={styles.key}
              disabled={!hasBiometrics || verifying}
            >
              <Fingerprint size={28} color={hasBiometrics ? THEME.primary : '#3f3f46'} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handlePress('0')} 
              style={styles.key}
              disabled={verifying}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handlePress('del')} 
              style={styles.key}
              disabled={verifying}
            >
              <Delete size={24} color={THEME.danger} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

// --- PIN SETUP SCREEN ---
const PinSetupScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePress = async (val: string) => {
    if (saving) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError('');
    
    if (val === 'del') {
      if (step === 'create') setPin(p => p.slice(0, -1));
      else setConfirmPin(p => p.slice(0, -1));
      return;
    }

    if (step === 'create') {
      const newPin = pin + val;
      setPin(newPin);
      if (newPin.length === 4) {
        // Check for weak PIN
        const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '3210'];
        if (weakPins.includes(newPin)) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setError('PIN is too weak. Choose a different one.');
          setPin('');
        } else {
          setStep('confirm');
        }
      }
    } else {
      const newConfirm = confirmPin + val;
      setConfirmPin(newConfirm);
      if (newConfirm.length === 4) {
        if (newConfirm === pin) {
          setSaving(true);
          const result = await SecurePinService.setupPin(pin);
          if (result.success) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onComplete();
          } else {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError(result.error || 'Failed to save PIN');
            setStep('create');
            setPin('');
            setConfirmPin('');
          }
          setSaving(false);
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError('PINs do not match. Try again.');
          setStep('create');
          setPin('');
          setConfirmPin('');
        }
      }
    }
  };

  const currentPin = step === 'create' ? pin : confirmPin;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#09090b', '#1e1b4b']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.lockIconContainer}>
        <Shield size={40} color={THEME.success} />
      </View>
      <Text style={styles.authTitle}>
        {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
      </Text>
      <Text style={styles.setupSubtext}>
        {step === 'create' 
          ? 'Choose a 4-digit PIN to secure your app' 
          : 'Enter your PIN again to confirm'}
      </Text>
      
      {error ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={16} color={THEME.danger} />
          <Text style={styles.pinErrorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              currentPin.length > i && styles.dotActive,
              saving && styles.dotVerifying
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <TouchableOpacity 
            key={n} 
            onPress={() => handlePress(n.toString())} 
            style={styles.key}
            disabled={saving}
          >
            <Text style={styles.keyText}>{n}</Text>
          </TouchableOpacity>
        ))}
        <View style={[styles.key, { backgroundColor: 'transparent', borderWidth: 0 }]} />
        <TouchableOpacity 
          onPress={() => handlePress('0')} 
          style={styles.key}
          disabled={saving}
        >
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handlePress('del')} 
          style={styles.key}
          disabled={saving}
        >
          <Delete size={24} color={THEME.danger} />
        </TouchableOpacity>
      </View>

      {saving && (
        <View style={styles.savingContainer}>
          <ActivityIndicator color={THEME.accent} />
          <Text style={styles.savingText}>Securing your PIN...</Text>
        </View>
      )}
    </View>
  );
};

// --- ROOT LAYOUT (The Guard) ---
export default function RootLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(true);
  
  // Track onboarding status
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null); 
  
  const appState = useRef(AppState.currentState);

  const checkPinStatus = useCallback(async () => {
    const pinSetup = await SecurePinService.isPinSetup();
    const pinEnabled = await SecurePinService.isPinEnabled();
    setNeedsPinSetup(!pinSetup);
    setIsPinEnabled(pinEnabled);
    // If PIN is not set up or disabled, don't lock
    if (!pinSetup || !pinEnabled) {
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    checkOnboarding();
    checkPinStatus();
    
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (hasSeenOnboarding !== null) setLoading(false); 
      if(!u) {
        setIsLocked(false);
        setNeedsPinSetup(false);
      } else {
        // Re-check PIN status when user logs in
        checkPinStatus();
      }
    });

    const sub = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        if (auth.currentUser) {
          const pinEnabled = await SecurePinService.isPinEnabled();
          const pinSetup = await SecurePinService.isPinSetup();
          if (pinEnabled && pinSetup) {
            setIsLocked(true);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => { unsub(); sub.remove(); };
  }, [hasSeenOnboarding, checkPinStatus]);

  const checkOnboarding = async () => {
    try {
      const value = await AsyncStorage.getItem('@dhanvayu_onboarded');
      setHasSeenOnboarding(value === 'true');
    } catch (e) {
      setHasSeenOnboarding(false);
    }
  };

  const handleOnboardingFinish = async () => {
    await AsyncStorage.setItem('@dhanvayu_onboarded', 'true');
    setHasSeenOnboarding(true);
  };

  if (loading || hasSeenOnboarding === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  // 1. If not logged in -> Auth Screen
  if (!user) return <AuthScreen onLogin={setUser} />;

  // 2. If logged in but hasn't seen onboarding -> Onboarding Screen
  if (!hasSeenOnboarding) return <OnboardingScreen onFinish={handleOnboardingFinish} />;

  // 3. If logged in, onboarded, but needs PIN setup -> PIN Setup Screen
  if (needsPinSetup && isPinEnabled) {
    return <PinSetupScreen onComplete={() => {
      setNeedsPinSetup(false);
      setIsLocked(false);
    }} />;
  }

  // 4. If logged in, onboarded, has PIN, but locked -> Lock Screen
  if (isLocked && isPinEnabled) return <LockScreen onUnlock={() => setIsLocked(false)} />;

  // 4. Main App
  return (
    <>
      <StatusBar barStyle="light-content" />
      <UserProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </UserProvider>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' },
  authContent: { width: '100%', padding: 20 },
  glassCard: { backgroundColor: 'rgba(24,24,27,0.8)', padding: 30, borderRadius: 30, borderWidth: 1, borderColor: '#3f3f46' },
  logoGlow: { alignSelf: 'center', backgroundColor: 'rgba(217,70,239,0.1)', padding: 20, borderRadius: 50, marginBottom: 20 },
  authTitle: { fontSize: 28, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 10 },
  googleBtn: { backgroundColor: 'white', padding: 16, borderRadius: 16, alignItems: 'center' },
  googleBtnText: { fontWeight: 'bold', color: 'black' },
  input: { backgroundColor: '#27272a', borderRadius: 16, marginBottom: 16, padding: 18, color: 'white' },
  inputError: { borderColor: THEME.danger, borderWidth: 1, backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  errorText: { color: THEME.danger, fontSize: 12, marginTop: -10, marginBottom: 10, marginLeft: 4 },
  mainBtn: { padding: 18, borderRadius: 16, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' },
  // Lock screen styles
  lockIconContainer: { 
    backgroundColor: 'rgba(139, 92, 246, 0.1)', 
    padding: 20, 
    borderRadius: 50, 
    marginBottom: 20 
  },
  pinDotsContainer: { 
    flexDirection: 'row', 
    gap: 15, 
    marginBottom: 40, 
    marginTop: 20,
    height: 20 
  },
  dot: { 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: '#27272a', 
    borderWidth: 1, 
    borderColor: '#3f3f46' 
  },
  dotActive: { 
    backgroundColor: THEME.accent 
  },
  dotVerifying: { 
    backgroundColor: THEME.warning 
  },
  keypad: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    width: 280, 
    gap: 20, 
    justifyContent: 'center' 
  },
  key: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#18181b', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#27272a' 
  },
  keyText: { 
    fontSize: 24, 
    color: 'white', 
    fontWeight: 'bold' 
  },
  // Lockout styles
  lockoutContainer: { 
    alignItems: 'center', 
    padding: 20, 
    marginTop: 20 
  },
  lockoutText: { 
    color: THEME.warning, 
    fontSize: 16, 
    marginTop: 10 
  },
  lockoutTimer: { 
    color: 'white', 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginTop: 10 
  },
  attemptsText: { 
    color: THEME.warning, 
    fontSize: 14, 
    marginTop: 5 
  },
  // PIN Setup styles
  setupSubtext: { 
    color: '#a1a1aa', 
    fontSize: 14, 
    textAlign: 'center', 
    marginBottom: 10,
    paddingHorizontal: 40
  },
  errorContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
    padding: 12, 
    borderRadius: 12, 
    marginTop: 10 
  },
  pinErrorText: { 
    color: THEME.danger, 
    fontSize: 13 
  },
  savingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginTop: 30 
  },
  savingText: { 
    color: '#a1a1aa', 
    fontSize: 14 
  },
});