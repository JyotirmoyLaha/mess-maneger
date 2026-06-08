import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  db,
  auth,
  appId,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
  getDoc,
  googleWebClientId,
} from './firebase';
import { signOut } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Colors, Shadows } from './components/Theme';
import Login from './components/Login';
import ExpenseForm from './components/ExpenseForm';
import ExpenseHistory from './components/ExpenseHistory';
import MemberContributions from './components/MemberContributions';
import RemainingHistory from './components/RemainingHistory';
import { LogOut, Wallet, Edit2, ShieldAlert, Plus, LayoutDashboard } from 'lucide-react-native';

const MESS_MEMBERS = [
  { id: 'jyotirmoy', name: 'Jyotirmoy' },
  { id: 'soumik', name: 'Soumik' },
  { id: 'subhajit', name: 'Subhajit' },
  { id: 'debdeep', name: 'Debdeep' },
  { id: 'siddarth', name: 'Siddarth' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core app state
  const [expenses, setExpenses] = useState([]);
  const [totalFund, setTotalFund] = useState(0);
  const [currentMonth, setCurrentMonth] = useState('');
  const [previousMonthSpent, setPreviousMonthSpent] = useState(0);
  
  const [memberFunds, setMemberFunds] = useState({});
  const [memberFundsMonth, setMemberFundsMonth] = useState('');
  
  const [monthlyRemainingHistory, setMonthlyRemainingHistory] = useState([]);
  const [carryForwardBalance, setCarryForwardBalance] = useState(0);
  
  const [viewMode, setViewMode] = useState('daily');
  const [editId, setEditId] = useState(null);

  // Modal states
  const [fundModalVisible, setFundModalVisible] = useState(false);
  const [fundAmountInput, setFundAmountInput] = useState('');
  const [addFundInput, setAddFundInput] = useState('');
  const [savingFund, setSavingFund] = useState(false);

  // Load session from storage on launch and verify authorization
  useEffect(() => {
    const initApp = async () => {
      try {
        GoogleSignin.configure({
          webClientId: googleWebClientId,
          offlineAccess: true,
        });

        const session = await AsyncStorage.getItem('user_session');
        if (session) {
          const parsed = JSON.parse(session);
          if (parsed.email) {
            const emailLower = parsed.email.toLowerCase();
            
            // Set user temporarily so the dashboard mounts immediately
            setCurrentUser(parsed);

            // Verify authorization against Firestore in the background
            let isAuthorized = false;
            let isAdmin = false;
            let dbChecked = false;
            try {
              const accessControlRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'access_control');
              const docSnap = await getDoc(accessControlRef);
              if (docSnap.exists()) {
                const data = docSnap.data();
                const authorizedEmails = (data.authorized_emails || []).map(e => e.toLowerCase());
                const adminEmail = (data.admin_email || '').toLowerCase();
                isAuthorized = authorizedEmails.includes(emailLower);
                isAdmin = adminEmail === emailLower;
                dbChecked = true;
              }
            } catch (dbErr) {
              console.log('Background Firestore verification failed:', dbErr.message);
            }

            if (dbChecked) {
              if (isAuthorized) {
                if (emailLower.includes('jyotirmoy')) {
                  parsed.displayName = 'J.L';
                } else if (!parsed.displayName || parsed.displayName.includes('@')) {
                  const username = emailLower.split('@')[0];
                  parsed.displayName = username.charAt(0).toUpperCase() + username.slice(1);
                }
                parsed.isAdmin = isAdmin;
                setCurrentUser(parsed);
                await AsyncStorage.setItem('user_session', JSON.stringify(parsed));
              } else {
                // Clear invalid session
                await AsyncStorage.removeItem('user_session');
                await signOut(auth);
                try {
                  await GoogleSignin.signOut();
                } catch (e) {}
                setCurrentUser(null);
                console.log('Unauthorized email, session cleared:', emailLower);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error during app initialization:', e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // Set up real-time Firebase listeners once user is logged in
  useEffect(() => {
    if (!currentUser) return;

    // 1. Expenses Listener
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'mess_expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setExpenses(data);
    }, (err) => {
      console.error('Expenses listener error:', err);
    });

    // 2. Fund Summary Listener
    const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
    const unsubFund = onSnapshot(fundRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setTotalFund(d.amount || 0);
        setCurrentMonth(d.currentMonth || getCurrentMonthKey());
        setPreviousMonthSpent(d.previousMonthSpent || 0);
      } else {
        setTotalFund(0);
        setCurrentMonth(getCurrentMonthKey());
        setPreviousMonthSpent(0);
      }
    }, (err) => {
      console.error('Fund listener error:', err);
    });

    // 3. Member Funds Listener
    let isResetting = false;
    const memberFundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');
    const unsubMemberFunds = onSnapshot(memberFundsRef, async (docSnap) => {
      if (isResetting) return;

      const currentMonthKey = getCurrentMonthKey();
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.month !== currentMonthKey) {
          isResetting = true;
          await resetMemberFunds(currentMonthKey);
          isResetting = false;
        } else {
          setMemberFunds(data.members || {});
          setMemberFundsMonth(data.month);
        }
      } else {
        isResetting = true;
        await initializeMemberFunds(currentMonthKey);
        isResetting = false;
      }
    }, (err) => {
      console.error('Member funds listener error:', err);
    });

    // 4. Carry Forward Balance History Listener
    const historyRef = doc(db, 'artifacts', appId, 'public', 'data', 'month_remaining', 'history');
    const unsubHistory = onSnapshot(historyRef, (docSnap) => {
      if (docSnap.exists()) {
        const months = docSnap.data().months || [];
        setMonthlyRemainingHistory(months);
        setCarryForwardBalance(months.reduce((sum, m) => sum + (m.remaining || 0), 0));
      } else {
        setMonthlyRemainingHistory([]);
        setCarryForwardBalance(0);
      }
    }, (err) => {
      console.error('History listener error:', err);
    });

    return () => {
      unsubExpenses();
      unsubFund();
      unsubMemberFunds();
      unsubHistory();
    };
  }, [currentUser]);

  // Check month transitions whenever expenses or fund config changes
  useEffect(() => {
    if (!currentUser || !currentMonth) return;
    checkAndUpdateMonthChange();
  }, [expenses, currentMonth]);

  // --- Date utilities ---
  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // --- Automated Month Transition Logic ---
  const checkAndUpdateMonthChange = async () => {
    const systemMonthKey = getCurrentMonthKey();
    if (currentMonth && currentMonth !== systemMonthKey) {
      // Calculate old month totals
      const oldMonthExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        const expMonthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        return expMonthKey === currentMonth;
      });

      const totalSpent = oldMonthExpenses.reduce((acc, curr) => acc + (curr.cost || 0), 0);
      const remainingBalance = totalFund - totalSpent;

      // Save carry forward to database
      await saveRemainingToHistory(currentMonth, remainingBalance, totalFund, totalSpent);

      // Transition the summary document to the new month
      try {
        const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
        await setDoc(fundRef, {
          amount: totalFund,
          currentMonth: systemMonthKey,
          previousMonthSpent: totalSpent,
          monthChangedAt: new Date().toISOString(),
          updatedBy: currentUser.displayName
        }, { merge: true });
        
        Alert.alert('Month Changed', `Remaining ₹${remainingBalance.toLocaleString('en-IN')} has been archived and carried forward.`);
      } catch (err) {
        console.error('Error updating month change:', err);
      }
    } else if (!currentMonth) {
      // Initialize first time
      try {
        const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
        await setDoc(fundRef, {
          currentMonth: systemMonthKey,
          previousMonthSpent: 0
        }, { merge: true });
      } catch (err) {
        console.error('Error initializing month:', err);
      }
    }
  };

  const saveRemainingToHistory = async (monthKey, remainingAmount, total, spent) => {
    try {
      const historyRef = doc(db, 'artifacts', appId, 'public', 'data', 'month_remaining', 'history');
      const docSnap = await getDoc(historyRef);
      let history = [];
      if (docSnap.exists()) {
        history = docSnap.data().months || [];
      }
      
      const existingIdx = history.findIndex(h => h.month === monthKey);
      const entry = {
        month: monthKey,
        remaining: remainingAmount,
        totalFund: total,
        totalSpent: spent,
        savedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        history[existingIdx] = entry;
      } else {
        history.push(entry);
      }

      history.sort((a, b) => b.month.localeCompare(a.month));

      await setDoc(historyRef, {
        months: history,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.displayName
      });
    } catch (err) {
      console.error('Error saving remaining to history:', err);
    }
  };

  // --- Member Contributions Database Logic ---
  const initializeMemberFunds = async (monthKey) => {
    const members = {};
    MESS_MEMBERS.forEach(m => {
      members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
    });
    try {
      const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');
      await setDoc(fundsRef, {
        month: monthKey,
        members: members,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.displayName
      });
    } catch (err) {
      console.error('Error initializing member funds:', err);
    }
  };

  const resetMemberFunds = async (monthKey) => {
    const members = {};
    MESS_MEMBERS.forEach(m => {
      members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
    });
    try {
      const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');
      await setDoc(fundsRef, {
        month: monthKey,
        members: members,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.displayName,
        resetAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error resetting member funds:', err);
    }
  };

  const handleAddMemberMoney = async (memberId, amount) => {
    const currentMonthKey = getCurrentMonthKey();
    const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');

    try {
      const docSnap = await getDoc(fundsRef);
      let data;
      if (docSnap.exists()) {
        data = docSnap.data();
      } else {
        data = { month: currentMonthKey, members: {} };
      }

      if (!data.members[memberId]) {
        const member = MESS_MEMBERS.find(m => m.id === memberId);
        data.members[memberId] = { name: member ? member.name : memberId, totalMoney: 0, contributions: [] };
      }

      data.members[memberId].contributions.push({
        amount: amount,
        date: new Date().toISOString()
      });
      data.members[memberId].totalMoney = data.members[memberId].contributions.reduce((sum, c) => sum + c.amount, 0);
      data.lastUpdated = new Date().toISOString();
      data.updatedBy = currentUser.displayName;

      await setDoc(fundsRef, data);
    } catch (err) {
      Alert.alert('Error', 'Failed to add money.');
      console.error(err);
    }
  };

  const handleEditMemberMoney = async (memberId, newTotal) => {
    const currentMonthKey = getCurrentMonthKey();
    const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');

    try {
      const docSnap = await getDoc(fundsRef);
      let data;
      if (docSnap.exists()) {
        data = docSnap.data();
      } else {
        data = { month: currentMonthKey, members: {} };
      }

      if (!data.members[memberId]) {
        const member = MESS_MEMBERS.find(m => m.id === memberId);
        data.members[memberId] = { name: member ? member.name : memberId, totalMoney: 0, contributions: [] };
      }

      data.members[memberId].totalMoney = newTotal;
      data.members[memberId].contributions = [{ amount: newTotal, date: new Date().toISOString(), note: 'Edited by admin' }];
      data.lastUpdated = new Date().toISOString();
      data.updatedBy = currentUser.displayName;

      await setDoc(fundsRef, data);
    } catch (err) {
      Alert.alert('Error', 'Failed to update contribution.');
      console.error(err);
    }
  };

  // --- Expenses Actions ---
  const handleExpenseSubmit = async (item, cost, id) => {
    try {
      if (id) {
        // Edit existing
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_expenses', id);
        await updateDoc(docRef, {
          item: item,
          cost: cost,
          updatedAt: new Date().toISOString()
        });
        setEditId(null);
      } else {
        // Add new
        const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'mess_expenses');
        await addDoc(collectionRef, {
          item: item,
          cost: cost,
          addedBy: currentUser.displayName,
          userPhoto: currentUser.photoURL || '',
          userId: currentUser.uid,
          date: new Date().toISOString()
        });
      }
    } catch (err) {
      Alert.alert('Save Failed', 'Unable to write expense to database.');
      console.error(err);
    }
  };

  const handleExpenseDelete = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_expenses', id);
      await deleteDoc(docRef);
    } catch (err) {
      Alert.alert('Delete Failed', 'Unable to delete item.');
      console.error(err);
    }
  };

  // --- Fund Management ---
  const openFundModal = () => {
    setFundAmountInput(String(totalFund));
    setFundModalVisible(true);
  };

  const handleFundUpdateSubmit = async () => {
    const amount = parseFloat(fundAmountInput);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setSavingFund(true);
    try {
      const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
      await setDoc(fundRef, {
        amount: amount,
        currentMonth: currentMonth || getCurrentMonthKey(),
        previousMonthSpent: previousMonthSpent,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setFundModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to update total fund.');
      console.error(err);
    } finally {
      setSavingFund(false);
    }
  };

  const handleAddFundSubmit = async () => {
    const amountToAdd = parseFloat(addFundInput);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    try {
      const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
      const newTotal = totalFund + amountToAdd;
      await setDoc(fundRef, {
        amount: newTotal,
        currentMonth: currentMonth || getCurrentMonthKey(),
        previousMonthSpent: previousMonthSpent,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setAddFundInput('');
      Alert.alert('Success', `₹${amountToAdd} added to fund.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to add money to fund.');
      console.error(err);
    }
  };

  // --- Logout ---
  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            try {
              await GoogleSignin.signOut();
            } catch (googleError) {
              console.log('Google Sign-In signout error:', googleError);
            }
            try {
              await AsyncStorage.removeItem('user_session');
            } catch (e) {}
            setCurrentUser(null);
          } catch (e) {
            console.error('Error logging out:', e);
          }
        }
      }
    ]);
  };

  // Refresh control handler
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Fake pull to refresh to check database
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Filter current month expenses to calculate spent/remaining
  const currentMonthKey = getCurrentMonthKey();
  const currentMonthExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    const expMonthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
    return expMonthKey === currentMonthKey;
  });

  const totalSpent = currentMonthExpenses.reduce((sum, item) => sum + (item.cost || 0), 0);
  const remainingBalance = totalFund - totalSpent;
  const progressPercent = totalFund > 0 ? Math.min((totalSpent / totalFund) * 100, 100) : 0;

  // View state loaders
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.emerald} />
        <Text style={styles.loadingText}>INITIALIZING...</Text>
      </View>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* App Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.logoRow}>
            <LayoutDashboard size={12} color="rgba(16, 185, 129, 0.7)" />
            <Text style={styles.headerTag}>MESS EXPENSE</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.welcomeText}>Hi, </Text>
            <Text style={styles.userName} numberOfLines={1}>{currentUser.displayName}</Text>
            {currentUser.isAdmin ? (
              <View style={styles.adminBadge}>
                <ShieldAlert size={12} color="#f59e0b" />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            ) : null}
            <Text style={styles.wave}>👋</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Main Dashboard Scroll */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.emerald}
          />
        }
      >
        {/* 1. FUND STATUS CARD (Premium Credit Card Look) */}
        <View style={styles.fundCard}>
          {/* Inner details */}
          <View style={styles.fundHeader}>
            <View>
              <View style={styles.fundTagRow}>
                <View style={styles.greenPulse} />
                <Text style={styles.fundTagText}>TOTAL FUND</Text>
              </View>
              <View style={styles.totalFundRow}>
                <Text style={styles.totalFundVal}>₹{totalFund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                <TouchableOpacity
                  style={styles.editFundBtn}
                  onPress={openFundModal}
                  activeOpacity={0.6}
                >
                  <Edit2 size={12} color={Colors.emerald} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.walletIconBg}>
              <Wallet size={24} color={Colors.emerald} />
            </View>
          </View>

          {/* Balance / Spent Row */}
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
              <Text style={[
                styles.balanceValue,
                remainingBalance < 0 ? { color: Colors.red } : { color: Colors.emerald }
              ]}>
                ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.spentContainer}>
              <Text style={styles.spentLabel}>SPENT</Text>
              <View style={styles.spentBadge}>
                <Text style={styles.spentText}>₹{totalSpent.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
                remainingBalance < 0 && { backgroundColor: Colors.red }
              ]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressPctText}>0%</Text>
              <Text style={styles.progressPctText}>{Math.round(progressPercent)}% spent</Text>
            </View>
          </View>

          {/* Previous Month Spent Strip */}
          {previousMonthSpent > 0 ? (
            <View style={styles.prevMonthStrip}>
              <Text style={styles.prevMonthLabel}>Last Month Spent</Text>
              <View style={styles.prevMonthBadge}>
                <Text style={styles.prevMonthText}>₹{previousMonthSpent.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          ) : null}

          {/* Inline Add Money to Fund Form */}
          <View style={styles.addFundInlineForm}>
            <Text style={styles.addFundLabel}>Add to Fund</Text>
            <View style={styles.addFundRow}>
              <View style={styles.addFundInputWrapper}>
                <Text style={styles.addFundSymbol}>₹</Text>
                <TextInput
                  style={styles.addFundInput}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  value={addFundInput}
                  onChangeText={setAddFundInput}
                />
              </View>
              <TouchableOpacity
                style={styles.addFundBtn}
                onPress={handleAddFundSubmit}
                activeOpacity={0.8}
              >
                <Plus size={14} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.addFundBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2. MEMBER CONTRIBUTIONS CARD */}
        <MemberContributions
          memberFunds={memberFunds}
          isAdmin={currentUser.isAdmin}
          onAddMoney={handleAddMemberMoney}
          onEditMoney={handleEditMemberMoney}
        />

        {/* 3. PREVIOUS MONTHS REMAINING CARD */}
        <RemainingHistory
          history={monthlyRemainingHistory}
          carryForwardBalance={carryForwardBalance}
        />

        {/* 4. EXPENSE FORM */}
        <ExpenseForm
          editId={editId}
          expenses={expenses}
          onSubmitExpense={handleExpenseSubmit}
          onCancelEdit={() => setEditId(null)}
        />

        {/* 5. EXPENSE HISTORY LIST */}
        <ExpenseHistory
          expenses={expenses}
          viewMode={viewMode}
          currentUser={currentUser}
          isAdmin={currentUser.isAdmin}
          onSetViewMode={setViewMode}
          onEditExpense={(expense) => setEditId(expense.id)}
          onDeleteExpense={handleExpenseDelete}
        />
      </ScrollView>

      {/* UPDATE FUND MODAL */}
      <Modal
        visible={fundModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFundModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Wallet size={28} color={Colors.blue} />
            </View>
            <Text style={styles.modalTitle}>Update Fund</Text>
            <Text style={styles.modalDesc}>Total collected amount</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#cbd5e1"
                value={fundAmountInput}
                onChangeText={setFundAmountInput}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setFundModalVisible(false)}
                disabled={savingFund}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleFundUpdateSubmit}
                disabled={savingFund}
              >
                {savingFund ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  headerTag: {
    color: '#a7f3d0', // Emerald 200
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeText: {
    color: Colors.textSecondary,
    fontSize: 28,
    fontWeight: '500',
  },
  userName: {
    color: Colors.emerald,
    fontSize: 28,
    fontWeight: '900',
    maxWidth: 220,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
    gap: 4,
  },
  adminBadgeText: {
    color: '#fcd34d', // Amber 300
    fontSize: 12,
    fontWeight: '800',
  },
  wave: {
    fontSize: 20,
    marginLeft: 6,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    borderRadius: 12,
    ...Shadows.sm,
  },
  scrollContent: {
    padding: 16,
  },
  // Fund status card
  fundCard: {
    backgroundColor: '#1e293b',
    borderRadius: 28,
    padding: 22,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...Shadows.lg,
  },
  fundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  fundTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.emerald,
  },
  fundTagText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  totalFundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalFundVal: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  editFundBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 6,
    borderRadius: 8,
  },
  walletIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  balanceLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
  },
  spentContainer: {
    alignItems: 'flex-end',
  },
  spentLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  spentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  spentText: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 14,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.emerald,
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressPctText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  prevMonthStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  prevMonthLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  prevMonthBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prevMonthText: {
    color: '#fde047',
    fontSize: 12,
    fontWeight: '700',
  },
  addFundInlineForm: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  addFundLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  addFundRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addFundInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  addFundSymbol: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  addFundInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 8,
  },
  addFundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.emerald,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 4,
  },
  addFundBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Modal layout
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    ...Shadows.lg,
  },
  modalIconBg: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  modalTitle: {
    color: '#1e293b',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalDesc: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 20,
  },
  currencySymbol: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#1e293b',
    fontSize: 20,
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
