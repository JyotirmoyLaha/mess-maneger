import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, doc, getDoc, appId, auth, googleWebClientId } from '../firebase';
import { Colors, Shadows } from './Theme';
import { ChefHat, Mail, ShieldAlert, Lock, Zap, Sparkles } from 'lucide-react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { signInAnonymously, signOut, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId: googleWebClientId,
        offlineAccess: true,
      });
    } catch (e) {
      console.warn('Google Sign-In configuration error:', e);
    }
  }, []);

  // Diagnostic log for imports
  console.log('Login component mounting - checking icons:', {
    ChefHat: typeof ChefHat,
    Mail: typeof Mail,
    FontAwesome: typeof FontAwesome,
    ShieldAlert: typeof ShieldAlert,
    Lock: typeof Lock,
    Zap: typeof Zap,
    Sparkles: typeof Sparkles,
  });

  // Floating food emojis simulated coordinates
  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const normalizedEmail = email.trim().toLowerCase();
    let isAuthorized = false;
    let isAdmin = false;
    let displayName = '';
    let dbChecked = false;

    // 1. Try Firestore lookup first
    try {
      // Sign in anonymously to satisfy Firestore rules requiring a signed-in session
      await signInAnonymously(auth);

      const accessControlRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'access_control');
      console.log('Checking authorization for:', normalizedEmail);
      console.log('Firestore path:', accessControlRef.path);
      const docSnap = await getDoc(accessControlRef);

      console.log('Doc exists:', docSnap.exists());
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Firestore data:', JSON.stringify(data));
        const authorizedEmails = (data.authorized_emails || []).map(e => e.toLowerCase());
        const adminEmail = (data.admin_email || '').toLowerCase();

        console.log('Authorized emails:', authorizedEmails);
        console.log('Admin email:', adminEmail);

        isAuthorized = authorizedEmails.includes(normalizedEmail);
        isAdmin = adminEmail === normalizedEmail;
        dbChecked = true;

        console.log('Auth result - authorized:', isAuthorized, 'admin:', isAdmin);
      } else {
        console.log('Access control document does not exist!');
      }
    } catch (error) {
      console.error('Firestore check failed:', error);
    }

    // If Firestore check failed entirely, deny access
    if (!dbChecked) {
      setLoading(false);
      try { await signOut(auth); } catch (e) {}
      setErrorMsg('Unable to verify access. Please check your internet connection and try again.');
      return;
    }

    if (!isAuthorized) {
      // Sign out of the anonymous session if they aren't whitelisted
      try {
        await signOut(auth);
      } catch (e) {}
      setErrorMsg(`Access Denied: ${normalizedEmail} is not authorized. Please contact your mess admin to get access.`);
      setLoading(false);
      return;
    }

    if (isAuthorized) {
      // Format the display name from the email username
      let displayName = '';
      if (normalizedEmail.includes('jyotirmoy')) {
        displayName = 'J.L';
      } else {
        const username = normalizedEmail.split('@')[0];
        displayName = username.charAt(0).toUpperCase() + username.slice(1);
      }

      const sessionData = {
        email: normalizedEmail,
        displayName: displayName,
        photoURL: '', // simulated local profile photo
        isAdmin: isAdmin,
        uid: auth.currentUser ? auth.currentUser.uid : `simulated-uid-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '')}`,
      };

      try {
        await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
      } catch (e) {
        console.warn('Error saving session:', e);
      }
      onLoginSuccess(sessionData);
    } else {
      // Sign out of the anonymous session if they aren't whitelisted
      try {
        await signOut(auth);
      } catch (e) {}
      setErrorMsg(`Access Denied: ${email} is not authorized. Please contact your mess admin to get access.`);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Force account selection by signing out first
      try {
        await GoogleSignin.signOut();
      } catch (e) {}

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      
      const idToken = signInResult.idToken || (signInResult.data && signInResult.data.idToken);
      
      if (!idToken) {
        throw new Error('No ID token received from Google.');
      }
      
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      
      const normalizedEmail = (user.email || '').trim().toLowerCase();
      console.log('Google login - checking authorization for:', normalizedEmail);
      
      // === AUTHORIZATION CHECK ===
      let isAuthorized = false;
      let isAdmin = false;
      let dbChecked = false;
      
      // 1. Try Firestore lookup
      try {
        const accessControlRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'access_control');
        console.log('Google login - Checking authorization for:', normalizedEmail);
        console.log('Firestore path:', accessControlRef.path);
        const docSnap = await getDoc(accessControlRef);
        console.log('Firestore doc exists:', docSnap.exists());
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Firestore data:', JSON.stringify(data));
          const authorizedEmails = (data.authorized_emails || []).map(e => e.toLowerCase());
          const adminEmail = (data.admin_email || '').toLowerCase();
          
          console.log('Authorized emails from Firestore:', authorizedEmails);
          console.log('Admin email from Firestore:', adminEmail);
          
          isAuthorized = authorizedEmails.includes(normalizedEmail);
          isAdmin = adminEmail === normalizedEmail;
          dbChecked = true;
          
          console.log('Firestore check result - authorized:', isAuthorized, 'admin:', isAdmin);
        } else {
          console.log('Access control document does not exist!');
        }
      } catch (dbErr) {
        console.error('Firestore check FAILED:', dbErr);
      }
      
      // If Firestore check failed entirely, deny access
      if (!dbChecked) {
        await signOut(auth);
        try { await GoogleSignin.signOut(); } catch (e) {}
        setErrorMsg('Unable to verify access. Please check your internet connection and try again.');
        return;
      }
      
      console.log('Authorization result:', isAuthorized);
      
      if (!isAuthorized) {
        await signOut(auth);
        try { await GoogleSignin.signOut(); } catch (e) {}
        setErrorMsg(`Access Denied: ${normalizedEmail} is not authorized. Contact your mess admin.`);
        setLoading(false);
        return;
      }
      
      if (isAuthorized) {
        let displayName = '';
        if (normalizedEmail.includes('jyotirmoy')) {
          displayName = 'J.L';
        } else {
          const username = normalizedEmail.split('@')[0];
          displayName = username.charAt(0).toUpperCase() + username.slice(1);
        }
        
        const sessionData = {
          email: normalizedEmail,
          displayName: displayName,
          photoURL: user.photoURL || '',
          isAdmin: isAdmin,
          uid: user.uid,
        };
        
        try {
          await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
        } catch (e) {
          console.warn('Error saving session:', e);
        }
        onLoginSuccess(sessionData);
      } else {
        // Sign out from BOTH Firebase and Google
        await signOut(auth);
        try { await GoogleSignin.signOut(); } catch (e) {}
        setErrorMsg(`Access Denied: ${normalizedEmail} is not authorized. Contact your mess admin.`);
      }
    } catch (error) {
      console.error('Google Sign-in error:', error);
      setErrorMsg('Google login failed or was cancelled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <View style={styles.topBarSheen} />
          
          {/* Logo container */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoBg}>
              <ChefHat size={48} color="#ffffff" strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.title}>Mess Manager</Text>
          <Text style={styles.subtitle}>Smart expense tracking for your group.</Text>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <View style={styles.errorIconBg}>
                <ShieldAlert size={16} color={Colors.red} />
              </View>
              <View style={styles.errorTextWrapper}>
                <Text style={styles.errorTitle}>Access Restricted</Text>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            </View>
          ) : null}



          {/* Google Sign-in button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <FontAwesome name="google" size={18} color="#080c14" style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* Badges footer */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Lock size={10} color={Colors.textSecondary} />
              <Text style={styles.badgeText}>SECURE</Text>
            </View>
            <Text style={styles.badgeDot}>•</Text>
            <View style={styles.badge}>
              <Zap size={10} color={Colors.textSecondary} />
              <Text style={styles.badgeText}>FAST</Text>
            </View>
            <Text style={styles.badgeDot}>•</Text>
            <View style={styles.badge}>
              <Sparkles size={10} color={Colors.textSecondary} />
              <Text style={styles.badgeText}>SIMPLE</Text>
            </View>
          </View>

          {/* Dev Credits & Contacts */}
          <View style={styles.footer}>
            <Text style={styles.footerDevText}>
              Built by <Text style={styles.footerDevHighlight}>Jyotirmoy Laha</Text>
            </Text>
            <Text style={styles.footerContactTitle}>GET IN TOUCH</Text>
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('mailto:jyotirmoy713128@gmail.com')}
              >
                <Mail size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://www.linkedin.com/in/jyotirmoylaha2005/')}
              >
                <FontAwesome name="linkedin" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://github.com/JyotirmoyLaha')}
              >
                <FontAwesome name="github" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  particle: {
    position: 'absolute',
    zIndex: 0,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 30,
    alignItems: 'center',
    overflow: 'hidden',
    ...Shadows.lg,
  },
  topBarSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.emerald,
  },
  logoWrapper: {
    marginBottom: 24,
  },
  logoBg: {
    backgroundColor: Colors.emerald,
    padding: 18,
    borderRadius: 20,
    ...Shadows.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 36,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: Colors.redLight,
    borderWidth: 1,
    borderColor: Colors.redBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 24,
    width: '100%',
  },
  errorIconBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginRight: 10,
  },
  errorTextWrapper: {
    flex: 1,
  },
  errorTitle: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 15,
    lineHeight: 20,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 18,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '500',
  },
  button: {
    width: '100%',
    backgroundColor: Colors.emerald,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadows.md,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  orText: {
    color: Colors.textMuted,
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Shadows.md,
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: '#080c14',
    fontSize: 20,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badgeDot: {
    color: Colors.textMuted,
    marginHorizontal: 10,
    fontSize: 12,
  },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 24,
    alignItems: 'center',
  },
  footerDevText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  footerDevHighlight: {
    color: Colors.emerald,
    fontWeight: '800',
  },
  footerContactTitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 14,
  },
  socialButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 12,
  },
});
