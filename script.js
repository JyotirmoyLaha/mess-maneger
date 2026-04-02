import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, initializeFirestore, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signOut
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// --- Configuration loaded from gitignored config.js ---
// To set up: copy config.example.js → config.js and add your Firebase credentials
import { firebaseConfig, appId } from './config.js';

// ============================================
// AUTHORIZED MEMBERS - Loaded from Firestore
// Admin configures emails in Firestore collection:
// artifacts/{appId}/public/data/settings/access_control
// ============================================
let AUTHORIZED_EMAILS = [];
let ADMIN_EMAIL = '';

// Fetch authorized emails from Firestore
async function loadAccessControl() {
    try {
        const accessControlRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'access_control');
        const docSnap = await getDoc(accessControlRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            AUTHORIZED_EMAILS = data.authorized_emails || [];
            ADMIN_EMAIL = data.admin_email || '';
            return true;
        } else {
            console.error('Access control document not found in Firestore');
            return false;
        }
    } catch (error) {
        console.error('Error loading access control:', error);
        return false;
    }
}

const MESS_MEMBERS = [
    { id: 'jyotirmoy', name: 'Jyotirmoy' },
    { id: 'soumik', name: 'Soumik' },
    { id: 'subhajit', name: 'Subhajit' },
    { id: 'debdeep', name: 'Debdeep' },
    { id: 'siddarth', name: 'Siddarth' }
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let db;
try {
    db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false
    });
} catch (e) {
    db = getFirestore(app);
}

let state = {
    user: null, username: '', userPhoto: '', expenses: [], totalFund: 0, editId: null, deleteTargetId: null, loading: true, hasJoined: false, viewMode: 'daily', currentMonth: '', previousMonthSpent: 0, groupedExpenses: {}, isAdmin: false, memberFunds: {}, memberFundsMonth: '',
    carryForwardBalance: 0, monthlyRemainingHistory: []
};

const views = { loading: document.getElementById('loading-view'), login: document.getElementById('login-view'), dashboard: document.getElementById('dashboard-view') };

const elements = {
    googleLoginBtn: document.getElementById('google-login-btn'), displayUsername: document.getElementById('display-username'), logoutBtn: document.getElementById('logout-btn'),
    fundBalance: document.getElementById('fund-balance'), totalFund: document.getElementById('total-fund'), totalSpent: document.getElementById('total-spent'), editFundBtn: document.getElementById('edit-fund-btn'),
    expenseForm: document.getElementById('expense-form'), itemName: document.getElementById('item-name'), itemCost: document.getElementById('item-cost'), editId: document.getElementById('edit-id'), cancelEditBtn: document.getElementById('cancel-edit-btn'),
    expensesList: document.getElementById('expenses-list'), emptyState: document.getElementById('empty-state'), loginError: document.getElementById('login-error'), loginErrorText: document.getElementById('login-error-text'),
    dashError: document.getElementById('dashboard-error'), dashErrorText: document.getElementById('dashboard-error-text'), viewDailyBtn: document.getElementById('view-daily'), viewMonthlyBtn: document.getElementById('view-monthly'),
    deleteModal: document.getElementById('delete-modal'), cancelDeleteBtn: document.getElementById('cancel-delete-btn'), confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
    fundModal: document.getElementById('fund-modal'), fundForm: document.getElementById('fund-form'), fundInput: document.getElementById('fund-input'), cancelFundBtn: document.getElementById('cancel-fund-btn'),
    prevMonthInfo: document.getElementById('prev-month-info'), prevMonthSpent: document.getElementById('prev-month-spent'),
    remainingHistoryList: document.getElementById('remaining-history-list'), totalCarryForward: document.getElementById('total-carry-forward')
};

// --- STANDARD LOGIC ---

async function initAuth() {
    if (firebaseConfig.apiKey === "PASTE_API_KEY_HERE") {
        state.loading = false; render();
        setTimeout(() => showError("Config Error: Update index.html with keys.", true), 100); return;
    }
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { }
    }
}

elements.googleLoginBtn.addEventListener('click', async () => {
    hideError(true);
    const originalContent = elements.googleLoginBtn.innerHTML;
    elements.googleLoginBtn.disabled = true;
    elements.googleLoginBtn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600"></div>`;
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        let msg = "Sign-in failed.";
        if (error.code === 'auth/unauthorized-domain') msg = `Domain unauthorized: ${window.location.hostname}`;
        showError(msg, true);
        elements.googleLoginBtn.disabled = false;
        elements.googleLoginBtn.innerHTML = originalContent;
    }
});

onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (user) {
        // Load access control from Firestore first
        const accessLoaded = await loadAccessControl();
        
        if (!accessLoaded) {
            signOut(auth).then(() => {
                state.hasJoined = false;
                state.loading = false;
                showError('Unable to verify access. Please contact admin to set up access control in Firestore.', true);
                render();
            });
            return;
        }

        // Check if user email is authorized
        const userEmail = user.email ? user.email.toLowerCase() : '';
        const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail);

        if (!isAuthorized) {
            // Unauthorized user - sign them out immediately
            signOut(auth).then(() => {
                state.hasJoined = false;
                state.loading = false;
                showError(`Access Denied: ${userEmail} is not authorized. Please contact your mess admin to get access.`, true);
                render();
            });
            return;
        }

        // Authorized user - proceed normally
        state.username = user.displayName || (user.email ? user.email.split('@')[0] : 'Guest');
        state.userPhoto = user.photoURL;
        state.isAdmin = ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        state.hasJoined = true;
        setupDataListener();
    } else { state.hasJoined = false; }
    state.loading = false;
    render();
});

function setupDataListener() {
    if (!state.user) return;
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'mess_expenses');
    onSnapshot(expensesRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
        state.expenses = data;
        hideError(false);
        renderDashboardData();
    });
    const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
    onSnapshot(fundRef, (doc) => {
        if (doc.exists()) {
            state.totalFund = doc.data().amount || 0;
            state.currentMonth = doc.data().currentMonth || getCurrentMonthKey();
            state.previousMonthSpent = doc.data().previousMonthSpent || 0;
        } else {
            state.totalFund = 0;
            state.currentMonth = getCurrentMonthKey();
            state.previousMonthSpent = 0;
        }
        checkAndUpdateMonthChange();
        renderDashboardData();
    });
    setupMemberFundsListener();
    setupRemainingHistoryListener();
}

// Get current month as a key (YYYY-MM format)
function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Check if month has changed and update accordingly
async function checkAndUpdateMonthChange() {
    const currentMonth = getCurrentMonthKey();

    // If month has changed
    if (state.currentMonth && state.currentMonth !== currentMonth) {
        // Calculate total spent for the OLD month's expenses only
        const oldMonthExpenses = state.expenses.filter(exp => {
            const expDate = new Date(exp.date);
            const expMonthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
            return expMonthKey === state.currentMonth;
        });
        const totalSpent = oldMonthExpenses.reduce((acc, curr) => acc + (curr.cost || 0), 0);
        const remainingBalance = state.totalFund - totalSpent;

        // Save remaining balance to history
        await saveRemainingToHistory(state.currentMonth, remainingBalance, state.totalFund, totalSpent);

        // Update fund document with new month data
        try {
            const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
            await setDoc(fundRef, {
                amount: state.totalFund,
                currentMonth: currentMonth,
                previousMonthSpent: totalSpent,
                monthChangedAt: new Date().toISOString(),
                updatedBy: state.username
            }, { merge: true });

            showToast(`Month changed! Remaining ₹${remainingBalance.toLocaleString('en-IN')} saved to history`);
        } catch (err) {
            console.error("Error updating month change:", err);
        }
    } else if (!state.currentMonth) {
        // First time setup - initialize current month
        try {
            const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
            await setDoc(fundRef, {
                currentMonth: currentMonth,
                previousMonthSpent: 0
            }, { merge: true });
        } catch (err) {
            console.error("Error initializing month:", err);
        }
    }
}

// Save remaining balance to monthly history
async function saveRemainingToHistory(monthKey, remainingAmount, totalFund, totalSpent) {
    try {
        const historyRef = doc(db, 'artifacts', appId, 'public', 'data', 'month_remaining', 'history');
        const docSnap = await getDoc(historyRef);
        let history = [];
        if (docSnap.exists()) {
            history = docSnap.data().months || [];
        }
        // Avoid duplicate entry for same month
        const existingIdx = history.findIndex(h => h.month === monthKey);
        const entry = {
            month: monthKey,
            remaining: remainingAmount,
            totalFund: totalFund,
            totalSpent: totalSpent,
            savedAt: new Date().toISOString()
        };
        if (existingIdx >= 0) {
            history[existingIdx] = entry;
        } else {
            history.push(entry);
        }
        // Sort by month descending
        history.sort((a, b) => b.month.localeCompare(a.month));
        await setDoc(historyRef, {
            months: history,
            lastUpdated: new Date().toISOString(),
            updatedBy: state.username
        });
    } catch (err) {
        console.error('Error saving remaining to history:', err);
    }
}

// Listener for remaining balance history
function setupRemainingHistoryListener() {
    const historyRef = doc(db, 'artifacts', appId, 'public', 'data', 'month_remaining', 'history');
    onSnapshot(historyRef, (docSnap) => {
        if (docSnap.exists()) {
            state.monthlyRemainingHistory = docSnap.data().months || [];
            state.carryForwardBalance = state.monthlyRemainingHistory.reduce((sum, m) => sum + (m.remaining || 0), 0);
        } else {
            state.monthlyRemainingHistory = [];
            state.carryForwardBalance = 0;
        }
        renderRemainingHistory();
    });
}

elements.editFundBtn.addEventListener('click', () => { elements.fundInput.value = state.totalFund; elements.fundModal.classList.remove('hidden'); });
elements.cancelFundBtn.addEventListener('click', () => { elements.fundModal.classList.add('hidden'); });
elements.fundForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(elements.fundInput.value);
    if (isNaN(amount) || amount < 0) return;
    try {
        const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
        await setDoc(fundRef, {
            amount: amount,
            currentMonth: state.currentMonth || getCurrentMonthKey(),
            previousMonthSpent: state.previousMonthSpent,
            updatedBy: state.username,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        elements.fundModal.classList.add('hidden');
        showToast(`Fund updated`);
    } catch (err) { showToast("Failed to update", "error"); }
});

elements.viewDailyBtn.addEventListener('click', () => { state.viewMode = 'daily'; updateViewToggleUI(); renderDashboardData(); });
elements.viewMonthlyBtn.addEventListener('click', () => { state.viewMode = 'monthly'; updateViewToggleUI(); renderDashboardData(); });

function updateViewToggleUI() {
    if (state.viewMode === 'daily') {
        elements.viewDailyBtn.classList.add('bg-slate-800', 'text-white', 'shadow-sm'); elements.viewDailyBtn.classList.remove('text-slate-500', 'hover:bg-slate-100');
        elements.viewMonthlyBtn.classList.remove('bg-slate-800', 'text-white', 'shadow-sm'); elements.viewMonthlyBtn.classList.add('text-slate-500', 'hover:bg-slate-100');
    } else {
        elements.viewMonthlyBtn.classList.add('bg-slate-800', 'text-white', 'shadow-sm'); elements.viewMonthlyBtn.classList.remove('text-slate-500', 'hover:bg-slate-100');
        elements.viewDailyBtn.classList.remove('bg-slate-800', 'text-white', 'shadow-sm'); elements.viewDailyBtn.classList.add('text-slate-500', 'hover:bg-slate-100');
    }
}

elements.logoutBtn.addEventListener('click', () => { signOut(auth).then(() => { location.reload(); }); });

elements.expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = elements.itemName.value; const cost = elements.itemCost.value;
    if (!name || !cost) return;

    const btnText = document.getElementById('btn-text');
    const originalText = btnText.innerText;
    btnText.innerText = "Saving...";

    try {
        const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'mess_expenses');
        if (state.editId) {
            // Check permission before updating
            const expense = state.expenses.find(x => x.id === state.editId);
            if (!canModifyExpense(expense)) {
                showError("You don't have permission to edit this entry.", false);
                btnText.innerText = originalText;
                return;
            }
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_expenses', state.editId);
            await updateDoc(docRef, { item: name, cost: parseFloat(cost), updatedAt: new Date().toISOString() });
            cancelEdit();
        } else {
            await addDoc(collectionRef, { item: name, cost: parseFloat(cost), addedBy: state.username, userPhoto: state.userPhoto, userId: state.user.uid, date: new Date().toISOString() });
            elements.itemName.value = ''; elements.itemCost.value = '';
        }
    } catch (err) { showError("Save Failed.", false); }
    finally { btnText.innerText = originalText; }
});

elements.cancelEditBtn.addEventListener('click', cancelEdit);
function cancelEdit() { state.editId = null; elements.itemName.value = ''; elements.itemCost.value = ''; updateFormState(); }

// Check if current user can edit/delete an expense
function canModifyExpense(expense) {
    if (!expense || !state.user) return false;
    // Admin can modify any expense
    if (state.isAdmin) return true;
    // User can only modify their own expenses
    return expense.userId === state.user.uid;
}

document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const expense = state.expenses.find(x => x.id === id);
        if (!canModifyExpense(expense)) {
            showToast('You can only delete your own entries', 'error');
            return;
        }
        state.deleteTargetId = deleteBtn.dataset.id;
        elements.deleteModal.classList.remove('hidden');
        return;
    }
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const expense = state.expenses.find(x => x.id === id);
        if (!canModifyExpense(expense)) {
            showToast('You can only edit your own entries', 'error');
            return;
        }
        if (expense) { state.editId = id; elements.itemName.value = expense.item; elements.itemCost.value = expense.cost; updateFormState(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    const downloadDayBtn = e.target.closest('.download-day-btn');
    if (downloadDayBtn) {
        const key = downloadDayBtn.dataset.key;
        if (!key || !state.groupedExpenses[key]) return;
        downloadDailyExpensePdf(key, state.groupedExpenses[key]);
    }
    const downloadMonthBtn = e.target.closest('.download-month-btn');
    if (downloadMonthBtn) {
        const key = downloadMonthBtn.dataset.key;
        if (!key || !state.groupedExpenses[key]) return;
        downloadMonthlyExpensePdf(key, state.groupedExpenses[key]);
    }
    const editMemberBtn = e.target.closest('.edit-member-btn');
    if (editMemberBtn) {
        const memberId = editMemberBtn.dataset.memberId;
        const memberName = editMemberBtn.dataset.memberName;
        const memberTotal = parseFloat(editMemberBtn.dataset.memberTotal) || 0;
        document.getElementById('edit-member-id').value = memberId;
        document.getElementById('edit-member-total').value = memberTotal;
        document.getElementById('edit-member-name-label').textContent = `Update total for ${memberName}`;
        document.getElementById('edit-member-modal').classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
});

elements.cancelDeleteBtn.addEventListener('click', () => { state.deleteTargetId = null; elements.deleteModal.classList.add('hidden'); });
elements.confirmDeleteBtn.addEventListener('click', async () => {
    if (!state.deleteTargetId) return;

    // Check permission before deleting
    const expense = state.expenses.find(x => x.id === state.deleteTargetId);
    if (!canModifyExpense(expense)) {
        showError("You don't have permission to delete this entry.", false);
        elements.deleteModal.classList.add('hidden');
        state.deleteTargetId = null;
        return;
    }

    const originalText = elements.confirmDeleteBtn.innerHTML;
    elements.confirmDeleteBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>`;
    try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_expenses', state.deleteTargetId);
        await deleteDoc(docRef); elements.deleteModal.classList.add('hidden');
    } catch (err) { showError(`Delete Failed.`, false); elements.deleteModal.classList.add('hidden'); }
    finally { elements.confirmDeleteBtn.innerHTML = originalText; elements.confirmDeleteBtn.disabled = false; state.deleteTargetId = null; }
});

function render() {
    if (state.loading) { views.loading.classList.remove('hidden'); views.login.classList.add('hidden'); views.dashboard.classList.add('hidden'); }
    else if (!state.hasJoined) { views.loading.classList.add('hidden'); views.login.classList.remove('hidden'); views.dashboard.classList.add('hidden'); lucide.createIcons(); }
    else {
        views.loading.classList.add('hidden');
        views.login.classList.add('hidden');
        views.dashboard.classList.remove('hidden');
        elements.displayUsername.textContent = state.username;
        // Show admin badge if user is admin
        const adminBadge = document.getElementById('admin-badge');
        if (state.isAdmin) {
            adminBadge.classList.remove('hidden');
        } else {
            adminBadge.classList.add('hidden');
        }
        renderDashboardData();
        renderMemberFunds();
        renderRemainingHistory();
    }
}

function renderDashboardData() {
    // Filter expenses for current month only
    const currentMonthKey = getCurrentMonthKey();
    const currentMonthExpenses = state.expenses.filter(exp => {
        const expDate = new Date(exp.date);
        const expMonthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        return expMonthKey === currentMonthKey;
    });

    // Calculate total spent for current month only
    const totalSpent = currentMonthExpenses.reduce((acc, curr) => acc + (curr.cost || 0), 0);
    const remaining = state.totalFund - totalSpent;

    elements.totalSpent.textContent = formatCurrency(totalSpent);
    elements.totalFund.textContent = formatCurrency(state.totalFund);
    elements.fundBalance.textContent = formatBalance(remaining);

    // Update spending progress bar
    const progressBar = document.getElementById('spending-progress-bar');
    const progressLabel = document.getElementById('spending-percentage');
    if (progressBar && progressLabel) {
        const pct = state.totalFund > 0 ? Math.min((totalSpent / state.totalFund) * 100, 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressLabel.textContent = `${Math.round(pct)}% spent`;
        if (remaining < 0) { progressBar.classList.add('over-budget'); } else { progressBar.classList.remove('over-budget'); }
    }

    // Display previous month spent if available
    if (state.previousMonthSpent && state.previousMonthSpent > 0) {
        elements.prevMonthInfo.classList.remove('hidden');
        elements.prevMonthSpent.textContent = `₹${state.previousMonthSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else {
        elements.prevMonthInfo.classList.add('hidden');
    }

    if (remaining < 0) {
        elements.fundBalance.classList.remove('from-emerald-200', 'to-teal-100', 'text-transparent', 'bg-clip-text');
        elements.fundBalance.classList.add('text-red-300');
    } else {
        elements.fundBalance.classList.add('from-emerald-200', 'to-teal-100', 'text-transparent', 'bg-clip-text');
        elements.fundBalance.classList.remove('text-red-300');
    }

    if (state.expenses.length === 0) { elements.expensesList.innerHTML = ''; elements.emptyState.classList.remove('hidden'); return; }
    elements.emptyState.classList.add('hidden');

    const grouped = {}; const keys = [];
    state.expenses.forEach(ex => {
        const d = new Date(ex.date);
        let key, label;
        if (state.viewMode === 'daily') { key = d.toDateString(); label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }); }
        else { key = `${d.getFullYear()}-${d.getMonth()}`; label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
        if (!grouped[key]) { grouped[key] = { label: label, total: 0, items: [], sortTime: d.getTime() }; keys.push(key); }
        grouped[key].items.push(ex); grouped[key].total += ex.cost;
    });
    keys.sort((a, b) => grouped[b].sortTime - grouped[a].sortTime);
    state.groupedExpenses = grouped;

    elements.expensesList.innerHTML = keys.map((key, groupIdx) => {
        const group = grouped[key];
        const itemsHtml = group.items.map((expense, idx) => `
            <div class="expense-item flex justify-between items-center py-4 border-b border-slate-100/60 last:border-0 px-5 group" style="animation-delay: ${idx * 0.03}s">
                <div class="flex-1">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center border border-emerald-100/50 flex-shrink-0">
                            <i data-lucide="shopping-bag" class="w-3.5 h-3.5 text-emerald-500"></i>
                        </div>
                        <span class="font-bold text-slate-700 text-sm">${escapeHtml(expense.item)}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1.5 ml-11">
                        ${expense.userPhoto ? `<img src="${expense.userPhoto}" class="w-4 h-4 rounded-full shadow-sm ring-2 ring-white">` : `<div class="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-white"><i data-lucide="user" class="w-2.5 h-2.5 text-slate-500"></i></div>`} 
                        <span class="text-[11px] font-semibold text-slate-400">${escapeHtml(expense.addedBy)}</span>
                        <span class="text-[10px] text-slate-300">•</span>
                        <span class="text-[11px] text-slate-400 flex items-center gap-1"><i data-lucide="clock" class="w-2.5 h-2.5"></i>${new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1.5">
                    <span class="cost-badge text-emerald-600 font-bold text-sm bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100/80 shadow-sm">₹${expense.cost.toLocaleString('en-IN')}</span>
                    <div class="action-buttons-container flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${canModifyExpense(expense) ? `
                            <button class="action-btn edit-btn p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition" data-id="${expense.id}" title="Edit entry"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                            <button class="action-btn delete-btn p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition" data-id="${expense.id}" title="Delete entry"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        ` : `
                            <span class="text-[10px] text-slate-400 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200/60" title="You can only edit your own entries">Read-only</span>
                        `}
                    </div>
                </div>
            </div>`).join('');
        return `
            <div class="expense-group-card glass-card rounded-2xl overflow-hidden border border-white/50" style="animation-delay: ${groupIdx * 0.1}s">
                <div class="expense-group-header px-5 py-3.5 flex justify-between items-center">
                    <div class="flex items-center gap-2.5">
                        <div class="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100/60">
                            <i data-lucide="${state.viewMode === 'daily' ? 'calendar' : 'calendar-days'}" class="w-4 h-4 text-emerald-500"></i>
                        </div>
                        <span class="text-xs font-bold text-slate-600 uppercase tracking-wide">${group.label}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${state.viewMode === 'daily' ? `
                            <button class="download-pdf-btn download-day-btn text-[10px] font-bold uppercase bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1" data-key="${key}">
                                <i data-lucide="download" class="w-3 h-3"></i>
                                PDF
                            </button>
                        ` : `
                            <button class="download-pdf-btn download-month-btn text-[10px] font-bold uppercase bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1" data-key="${key}">
                                <i data-lucide="download" class="w-3 h-3"></i>
                                PDF
                            </button>
                        `}
                        <span class="text-slate-600 font-bold text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-100/80 shadow-sm">Total: ₹${group.total.toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <div>${itemsHtml}</div>
            </div>`;
    }).join('');
    lucide.createIcons();
}

function updateFormState() {
    const submitBtn = document.getElementById('submit-btn'); const formTitle = document.getElementById('form-title');
    if (!submitBtn || !formTitle) return;
    const btnText = document.getElementById('btn-text');
    if (state.editId) {
        submitBtn.classList.replace('from-emerald-600', 'from-blue-600'); submitBtn.classList.replace('to-teal-600', 'to-indigo-600');
        btnText.innerText = "Update Entry"; formTitle.innerHTML = `<div class="bg-blue-100 p-1.5 rounded-lg"><i data-lucide="edit-2" class="w-4 h-4 text-blue-500"></i></div><span class="text-blue-600">Edit Item</span>`;
        if (elements.cancelEditBtn) elements.cancelEditBtn.classList.remove('hidden');
    } else {
        submitBtn.classList.replace('from-blue-600', 'from-emerald-600'); submitBtn.classList.replace('to-indigo-600', 'to-teal-600');
        btnText.innerText = "Add Item"; formTitle.innerHTML = `<div class="bg-emerald-100 p-1.5 rounded-lg"><i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600"></i></div><span>Add Expense</span>`;
        if (elements.cancelEditBtn) elements.cancelEditBtn.classList.add('hidden');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showError(msg, isLogin) {
    if (isLogin) { elements.loginError.classList.remove('hidden'); elements.loginErrorText.textContent = msg; }
    else { elements.dashError.classList.remove('hidden'); elements.dashErrorText.textContent = msg; }
}
function hideError(isLogin) {
    if (isLogin) elements.loginError.classList.add('hidden'); else elements.dashError.classList.add('hidden');
}
function formatCurrency(amount) {
    const value = Math.abs(Number(amount) || 0);
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatBalance(amount) {
    const value = Number(amount) || 0;
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(text) { if (!text) return ''; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-bold z-50 flex items-center gap-2.5 backdrop-blur-md ${type === 'success' ? 'bg-slate-800/95 border border-slate-700/50' : 'bg-red-500/95 border border-red-400/50'}`;
    toast.innerHTML = type === 'success' ? `<div class="bg-emerald-500/20 p-1 rounded-lg"><i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i></div> ${msg}` : `<div class="bg-red-400/20 p-1 rounded-lg"><i data-lucide="alert-circle" class="w-4 h-4"></i></div> ${msg}`;
    document.body.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(10px)'; toast.style.transition = 'all 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 2700);
}

function formatRupees(amount) {
    const value = Number(amount) || 0;
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ════════════════════════════════════════════════════════════════════════════════
// PDF ENGINE  (jsPDF, A4 portrait = 595.28 × 841.89 pt)
// Design constants:
//   MARGIN  = 36 pt  each side
//   USABLE  = 595.28 - 72 = 523.28 ≈ 523 pt
//   ROW_FS  = 9.5 pt  (body font size – avoids wrap on long names)
//   LINE_H  = 13 pt  (inter-line spacing)
//   ROW_PAD = 14 pt  (top + bottom cell padding)
// Column layouts (x positions are ABSOLUTE, each column has its own maxWidth):
//
// DAILY (523 pt):
//   #  (25)  |  Item (195)  |  Added By (155)  |  Time (65)  |  Cost (83)
//   25+195+155+65+83 = 523
//
// MONTHLY (523 pt):
//   #  (25)  |  Date (60)  |  Item (185)  |  Added By (155)  |  Cost (98)
//   25+60+185+155+98 = 523
// ════════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// PDF SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draws the top header band (navy + emerald stripe).
 * Left side  → App name + period label
 * Right side → Report type + generated-by
 */
function buildPdfHeader(doc, reportType, periodLabel) {
    const PW = doc.internal.pageSize.getWidth();
    const M = 36;   // margin
    const BAND_H = 80;   // header band height

    // Navy band
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PW, BAND_H, 'F');

    // Emerald accent stripe
    doc.setFillColor(16, 185, 129);
    doc.rect(0, BAND_H - 3, PW, 3, 'F');

    // ── Left: App title ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Mess Manager', M, 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(167, 243, 208);  // emerald-200
    doc.text(periodLabel, M, 48);

    // ── Right: Report type + generated-by ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(209, 250, 229);  // emerald-100
    doc.text(reportType.toUpperCase(), PW - M, 30, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);  // slate-300
    const genText = `Generated by ${state.username || 'Mess Manager'}  ·  ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    doc.text(genText, PW - M, 48, { align: 'right' });
}

/**
 * Draws a slim footer on every page: left text + page counter.
 */
function buildPdfFooter(doc) {
    const N = doc.getNumberOfPages();
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M = 36;
    const FY = PH - 18;

    for (let i = 1; i <= N; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(M, FY - 8, PW - M, FY - 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Mess Manager  ·  Smart Expense Report', M, FY);
        doc.text(`Page ${i} of ${N}`, PW - M, FY, { align: 'right' });
    }
}

/**
 * Draws a dark table-header band for the given columns.
 * cols: [{ label, x, maxX, align? }]   (maxX = right boundary of column)
 * headerTopY: top of the band (band height is fixed 22pt)
 * Returns the Y position AFTER the band (ready to draw first row).
 */
function drawTableHeader(doc, cols, M, headerTopY) {
    const PW = doc.internal.pageSize.getWidth();
    const BAND = 22;

    doc.setFillColor(15, 23, 42);          // slate-900
    doc.rect(M, headerTopY, PW - M * 2, BAND, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(167, 243, 208);       // emerald-200

    const textY = headerTopY + 14;        // baseline inside band
    cols.forEach(col => {
        if ((col.align || 'left') === 'right') {
            doc.text(col.label, col.maxX, textY, { align: 'right' });
        } else {
            doc.text(col.label, col.x, textY);
        }
    });

    // Reset for body text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    return headerTopY + BAND;  // Y just below the band
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY EXPENSE PDF
// Layout (A4 portrait, margin=36, usable=523pt):
//   #  │  Item  │  Added By  │  Time  │  Cost
//  25  │  195   │   155      │   65   │   83    = 523 pt
// ═══════════════════════════════════════════════════════════════════════════════
function downloadDailyExpensePdf(dayKey, group) {
    if (!group || !group.items || group.items.length === 0) {
        showToast('No expenses for this day', 'error'); return;
    }
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { showToast('PDF library not loaded', 'error'); return; }

    // ── Page setup ────────────────────────────────────────────────────────────
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();   // 595.28 pt
    const PH = doc.internal.pageSize.getHeight();  // 841.89 pt
    const M = 36;                                  // left / right margin
    const FS = 9.5;                                 // body font size
    const LH = FS * 1.35;                          // line-height ≈ 12.8 pt
    const RPAD = 14;                                  // top+bottom cell padding
    const SAFE = 70;                                  // footer+card safe zone

    // ── Column definitions ────────────────────────────────────────────────────
    // x  = left edge of column
    // maxX = right edge (text never goes past here)
    // GAP = 8 pt gutter between columns prevents ALL overlap
    const GAP = 8;
    const c = {
        num: { label: '#', x: M, maxX: M + 25, align: 'right' },
        item: { label: 'Item', x: M + 25 + GAP, maxX: M + 25 + GAP + 195, align: 'left' },
        by: { label: 'Added By', x: 0, maxX: 0, align: 'left' },
        time: { label: 'Time', x: 0, maxX: 0, align: 'left' },
        cost: { label: 'Amount', x: 0, maxX: PW - M, align: 'right' },
    };
    // Derive remaining columns from right-most boundary backwards
    c.cost.x = PW - M - 88;
    c.time.maxX = c.cost.x - GAP;
    c.time.x = c.time.maxX - 62;
    c.by.maxX = c.time.x - GAP;
    c.by.x = c.item.maxX + GAP;
    // Column widths for splitTextToSize (no gutter inside text area)
    const W_ITEM = c.item.maxX - c.item.x - 2;
    const W_BY = c.by.maxX - c.by.x - 2;
    const COLS = [c.num, c.item, c.by, c.time, c.cost];

    // ── Header ────────────────────────────────────────────────────────────────
    const dayDate = new Date(dayKey);
    const dayLabel = dayDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    buildPdfHeader(doc, 'Daily Expense Report', dayLabel);

    // ── Info bar ──────────────────────────────────────────────────────────────
    let y = 92;
    doc.setFillColor(241, 245, 249);   // slate-100 info strip
    doc.rect(M, y, PW - M * 2, 22, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${group.items.length} expense${group.items.length !== 1 ? 's' : ''}`, M + 6, y + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(`Total: ${formatRupees(group.total)}`, PW - M - 6, y + 14, { align: 'right' });
    y += 28;

    // ── Table header ──────────────────────────────────────────────────────────
    y = drawTableHeader(doc, COLS, M, y);

    // ── Row loop ──────────────────────────────────────────────────────────────
    const items = [...group.items].sort((a, b) => new Date(a.date) - new Date(b.date));
    doc.setFontSize(FS);

    items.forEach((expense, idx) => {
        const itemLines = doc.splitTextToSize(String(expense.item || '—'), W_ITEM);
        const byLines = doc.splitTextToSize(String(expense.addedBy || '—'), W_BY);
        const maxLines = Math.max(itemLines.length, byLines.length, 1);
        const ROW_H = maxLines * LH + RPAD;

        // ── Page break ──────────────────────────────────────────────────────
        if (y + ROW_H > PH - SAFE) {
            doc.addPage();
            y = 36;
            y = drawTableHeader(doc, COLS, M, y);
        }

        // ── Row background ──────────────────────────────────────────────────
        if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
        } else {
            doc.setFillColor(248, 250, 252);
        }
        doc.rect(M, y, PW - M * 2, ROW_H, 'F');

        // Cell baseline & mid points
        const textY = y + RPAD / 2 + LH;   // first text line baseline
        const midY = y + ROW_H / 2 + LH / 2 - 1;  // vertical centre for single-line cells

        const timeStr = new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const costStr = formatRupees(expense.cost || 0);

        // # (serial, right-aligned in 25pt column)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(String(idx + 1), c.num.maxX, midY, { align: 'right' });

        // Item name (wrappable)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FS);
        doc.setTextColor(15, 23, 42);
        doc.text(itemLines, c.item.x, textY);

        // Added By (wrappable)
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(byLines, c.by.x, textY);

        // Time (single-line, muted)
        doc.setTextColor(100, 116, 139);
        doc.text(timeStr, c.time.x, midY);

        // Amount (right-aligned, bold, coloured)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(costStr, c.cost.maxX, midY, { align: 'right' });

        // Bottom row divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(M, y + ROW_H, PW - M, y + ROW_H);

        y += ROW_H;
    });

    // ── Summary card ─────────────────────────────────────────────────────────
    y += 16;
    const CH = 54;
    const CW = 195;
    if (y + CH > PH - 50) { doc.addPage(); y = 50; }

    doc.setFillColor(16, 185, 129);
    doc.roundedRect(PW - M - CW, y, CW, CH, 7, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(209, 250, 229);
    doc.text('TOTAL FOR THE DAY', PW - M - CW + 10, y + 16);
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(formatRupees(group.total), PW - M - 10, y + 40, { align: 'right' });

    buildPdfFooter(doc);
    const fileDate = dayDate.toISOString().slice(0, 10);
    doc.save(`mess-daily-${fileDate}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTHLY EXPENSE PDF
// Layout (A4 portrait, margin=36, usable=523pt):
//   #  │  Date  │  Item  │  Added By  │  Cost
//  25  │   60   │  185   │   155      │   98   = 523 pt
// ═══════════════════════════════════════════════════════════════════════════════
function downloadMonthlyExpensePdf(monthKey, group) {
    if (!group || !group.items || group.items.length === 0) {
        showToast('No expenses for this month', 'error'); return;
    }
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { showToast('PDF library not loaded', 'error'); return; }

    const [yearStr, monthIdxStr] = String(monthKey).split('-');
    const monthIndex = Number(monthIdxStr);
    const monthDate = new Date(Number(yearStr), monthIndex, 1);

    // ── Page setup ────────────────────────────────────────────────────────────
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M = 36;
    const FS = 9.5;
    const LH = FS * 1.35;
    const RPAD = 14;
    const SAFE = 70;

    // ── Column definitions ────────────────────────────────────────────────────
    const GAP = 8;
    const c = {
        num: { label: '#', x: M, maxX: M + 25, align: 'right' },
        date: { label: 'Date', x: M + 25 + GAP, maxX: M + 25 + GAP + 60, align: 'left' },
        item: { label: 'Item', x: 0, maxX: 0, align: 'left' },
        by: { label: 'Added By', x: 0, maxX: 0, align: 'left' },
        cost: { label: 'Amount', x: 0, maxX: PW - M, align: 'right' },
    };
    c.cost.x = PW - M - 98;
    c.by.maxX = c.cost.x - GAP;
    c.by.x = c.by.maxX - 150;
    c.item.maxX = c.by.x - GAP;
    c.item.x = c.date.maxX + GAP;
    const W_ITEM = c.item.maxX - c.item.x - 2;
    const W_BY = c.by.maxX - c.by.x - 2;
    const COLS = [c.num, c.date, c.item, c.by, c.cost];

    // ── Header ────────────────────────────────────────────────────────────────
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    buildPdfHeader(doc, 'Monthly Expense Report', monthLabel);

    // ── Info bar ──────────────────────────────────────────────────────────────
    let y = 92;
    doc.setFillColor(241, 245, 249);
    doc.rect(M, y, PW - M * 2, 22, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${group.items.length} expense${group.items.length !== 1 ? 's' : ''}`, M + 6, y + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(`Total: ${formatRupees(group.total)}`, PW - M - 6, y + 14, { align: 'right' });
    y += 28;

    // ── Table header ──────────────────────────────────────────────────────────
    y = drawTableHeader(doc, COLS, M, y);

    // ── Row loop ──────────────────────────────────────────────────────────────
    const items = [...group.items].sort((a, b) => new Date(a.date) - new Date(b.date));
    doc.setFontSize(FS);

    items.forEach((expense, idx) => {
        const itemLines = doc.splitTextToSize(String(expense.item || '—'), W_ITEM);
        const byLines = doc.splitTextToSize(String(expense.addedBy || '—'), W_BY);
        const maxLines = Math.max(itemLines.length, byLines.length, 1);
        const ROW_H = maxLines * LH + RPAD;

        // ── Page break ──────────────────────────────────────────────────────
        if (y + ROW_H > PH - SAFE) {
            doc.addPage();
            y = 36;
            y = drawTableHeader(doc, COLS, M, y);
        }

        // ── Row background ──────────────────────────────────────────────────
        if (idx % 2 === 0) { doc.setFillColor(255, 255, 255); }
        else { doc.setFillColor(248, 250, 252); }
        doc.rect(M, y, PW - M * 2, ROW_H, 'F');

        const textY = y + RPAD / 2 + LH;
        const midY = y + ROW_H / 2 + LH / 2 - 1;

        const dateStr = new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const costStr = formatRupees(expense.cost || 0);

        // # serial
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(String(idx + 1), c.num.maxX, midY, { align: 'right' });

        // Date
        doc.setFontSize(FS);
        doc.setTextColor(100, 116, 139);
        doc.text(dateStr, c.date.x, midY);

        // Item (wrappable)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(itemLines, c.item.x, textY);

        // Added By (wrappable)
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(byLines, c.by.x, textY);

        // Amount
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(costStr, c.cost.maxX, midY, { align: 'right' });

        // Row divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(M, y + ROW_H, PW - M, y + ROW_H);

        y += ROW_H;
    });

    // ── Summary card ─────────────────────────────────────────────────────────
    y += 16;
    const CH = 54;
    const CW = 215;
    if (y + CH > PH - 50) { doc.addPage(); y = 50; }

    doc.setFillColor(15, 118, 110);
    doc.roundedRect(PW - M - CW, y, CW, CH, 7, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(204, 251, 241);
    doc.text('TOTAL FOR THE MONTH', PW - M - CW + 10, y + 16);
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(formatRupees(group.total), PW - M - 10, y + 40, { align: 'right' });

    buildPdfFooter(doc);
    const fileMonth = `${yearStr}-${String(Number(monthIndex) + 1).padStart(2, '0')}`;
    doc.save(`mess-monthly-${fileMonth}.pdf`);
}

// ============================================
// MEMBER FUND CONTRIBUTIONS
// ============================================

let _isResettingMemberFunds = false;
let _lastResetMonth = '';

function setupMemberFundsListener() {
    const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');
    onSnapshot(fundsRef, (docSnap) => {
        // If we are currently writing a reset, ignore this snapshot to prevent loops
        if (_isResettingMemberFunds) return;

        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentMonth = getCurrentMonthKey();
            if (data.month !== currentMonth && _lastResetMonth !== currentMonth) {
                // Month has changed and we haven't already reset for this month
                state.memberFunds = {};
                state.memberFundsMonth = currentMonth;
                resetMemberFunds(currentMonth);
            } else {
                // Same month or already reset — just use the data as-is
                state.memberFunds = data.members || {};
                state.memberFundsMonth = data.month;
            }
        } else {
            state.memberFunds = {};
            state.memberFundsMonth = getCurrentMonthKey();
            initializeMemberFunds();
        }
        renderMemberFunds();
    });
}

async function initializeMemberFunds() {
    const currentMonth = getCurrentMonthKey();
    const members = {};
    MESS_MEMBERS.forEach(m => {
        members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
    });
    _isResettingMemberFunds = true;
    try {
        const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');
        await setDoc(fundsRef, {
            month: currentMonth,
            members: members,
            lastUpdated: new Date().toISOString(),
            updatedBy: state.username
        });
        _lastResetMonth = currentMonth;
    } catch (err) {
        console.error('Error initializing member funds:', err);
    } finally {
        _isResettingMemberFunds = false;
    }
}

async function resetMemberFunds(newMonth) {
    const members = {};
    MESS_MEMBERS.forEach(m => {
        members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
    });
    _isResettingMemberFunds = true;
    try {
        const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');
        await setDoc(fundsRef, {
            month: newMonth,
            members: members,
            lastUpdated: new Date().toISOString(),
            updatedBy: state.username,
            resetAt: new Date().toISOString()
        });
        _lastResetMonth = newMonth;
        showToast('Member funds reset for new month');
    } catch (err) {
        console.error('Error resetting member funds:', err);
    } finally {
        _isResettingMemberFunds = false;
    }
}

async function addMemberMoney(memberId, amount) {
    if (!memberId || isNaN(amount) || amount <= 0) return;

    const currentMonth = getCurrentMonthKey();
    const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');

    try {
        const docSnap = await getDoc(fundsRef);
        let data;
        if (docSnap.exists()) {
            data = docSnap.data();
            if (data.month !== currentMonth) {
                await resetMemberFunds(currentMonth);
                data = { month: currentMonth, members: {} };
                MESS_MEMBERS.forEach(m => {
                    data.members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
                });
            }
        } else {
            data = { month: currentMonth, members: {} };
            MESS_MEMBERS.forEach(m => {
                data.members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
            });
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
        data.updatedBy = state.username;

        await setDoc(fundsRef, data);
        showToast(`₹${amount} added for ${data.members[memberId].name}`);
    } catch (err) {
        showToast('Failed to add money', 'error');
        console.error(err);
    }
}

async function editMemberMoney(memberId, newTotal) {
    if (!memberId || isNaN(newTotal) || newTotal < 0) return;

    const currentMonth = getCurrentMonthKey();
    const fundsRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_funds', 'current');

    try {
        const docSnap = await getDoc(fundsRef);
        let data;
        if (docSnap.exists()) {
            data = docSnap.data();
        } else {
            data = { month: currentMonth, members: {} };
            MESS_MEMBERS.forEach(m => {
                data.members[m.id] = { name: m.name, totalMoney: 0, contributions: [] };
            });
        }

        if (!data.members[memberId]) {
            const member = MESS_MEMBERS.find(m => m.id === memberId);
            data.members[memberId] = { name: member ? member.name : memberId, totalMoney: 0, contributions: [] };
        }

        data.members[memberId].totalMoney = newTotal;
        data.members[memberId].contributions = [{ amount: newTotal, date: new Date().toISOString(), note: 'Edited by admin' }];
        data.lastUpdated = new Date().toISOString();
        data.updatedBy = state.username;

        await setDoc(fundsRef, data);
        showToast(`Updated ${data.members[memberId].name}'s total to ₹${newTotal}`);
    } catch (err) {
        showToast('Failed to update', 'error');
        console.error(err);
    }
}

function renderMemberFunds() {
    const listEl = document.getElementById('member-funds-list');
    const monthEl = document.getElementById('member-fund-month');
    const addBtn = document.getElementById('add-money-btn');
    if (!listEl) return;

    const now = new Date();
    if (monthEl) {
        monthEl.textContent = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    if (addBtn) {
        addBtn.classList.remove('hidden');
    }

    let grandTotal = 0;
    const colors = [
        { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-100/50', icon: 'text-emerald-500', badge: 'bg-emerald-50 text-emerald-600 border-emerald-100/80' },
        { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-100/50', icon: 'text-blue-500', badge: 'bg-blue-50 text-blue-600 border-blue-100/80' },
        { bg: 'from-purple-50 to-violet-50', border: 'border-purple-100/50', icon: 'text-purple-500', badge: 'bg-purple-50 text-purple-600 border-purple-100/80' },
        { bg: 'from-amber-50 to-orange-50', border: 'border-amber-100/50', icon: 'text-amber-500', badge: 'bg-amber-50 text-amber-600 border-amber-100/80' },
        { bg: 'from-rose-50 to-pink-50', border: 'border-rose-100/50', icon: 'text-rose-500', badge: 'bg-rose-50 text-rose-600 border-rose-100/80' }
    ];

    listEl.innerHTML = MESS_MEMBERS.map((member, idx) => {
        const memberData = state.memberFunds[member.id] || { totalMoney: 0, contributions: [] };
        const total = memberData.totalMoney || 0;
        grandTotal += total;
        const contributionCount = (memberData.contributions || []).length;
        const color = colors[idx % colors.length];

        return `
        <div class="member-fund-item flex justify-between items-center py-3.5 px-5 group">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center ${color.border} border flex-shrink-0 shadow-sm">
                    <i data-lucide="user" class="w-4 h-4 ${color.icon}"></i>
                </div>
                <div>
                    <span class="font-bold text-slate-700 text-sm">${escapeHtml(member.name)}</span>
                    <div class="text-[10px] text-slate-400 font-medium">${contributionCount} contribution${contributionCount !== 1 ? 's' : ''}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="font-bold text-sm ${color.badge} px-2.5 py-1 rounded-lg border shadow-sm">₹${total.toLocaleString('en-IN')}</span>
                                <button class="edit-member-btn action-btn p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition opacity-0 group-hover:opacity-100" data-member-id="${member.id}" data-member-name="${escapeHtml(member.name)}" data-member-total="${total}" title="Edit total">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
            </div>
        </div>`;
    }).join('');

    listEl.innerHTML += `
        <div class="flex justify-between items-center py-3.5 px-5 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-b-2xl">
            <span class="font-bold text-slate-600 text-sm flex items-center gap-2">
                <div class="bg-slate-200/80 p-1.5 rounded-lg">
                    <span class="text-xs font-black text-slate-500">Σ</span>
                </div>
                Grand Total
            </span>
            <span class="font-extrabold text-sm text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-sm">₹${grandTotal.toLocaleString('en-IN')}</span>
        </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// PREVIOUS MONTHS REMAINING BALANCE
// ============================================

function renderRemainingHistory() {
    const card = document.getElementById('remaining-history-card');
    const listEl = elements.remainingHistoryList;
    const totalEl = elements.totalCarryForward;
    if (!listEl || !card) return;

    const history = state.monthlyRemainingHistory || [];
    if (history.length === 0) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    // Total carry-forward
    const totalRemaining = history.reduce((sum, m) => sum + (m.remaining || 0), 0);
    if (totalEl) {
        totalEl.textContent = `₹${totalRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const monthColors = [
        { bg: 'from-teal-50 to-emerald-50', border: 'border-teal-100/50', icon: 'text-teal-500', badge: 'bg-teal-50 text-teal-600 border-teal-100/80' },
        { bg: 'from-cyan-50 to-sky-50', border: 'border-cyan-100/50', icon: 'text-cyan-500', badge: 'bg-cyan-50 text-cyan-600 border-cyan-100/80' },
        { bg: 'from-indigo-50 to-blue-50', border: 'border-indigo-100/50', icon: 'text-indigo-500', badge: 'bg-indigo-50 text-indigo-600 border-indigo-100/80' },
        { bg: 'from-violet-50 to-purple-50', border: 'border-violet-100/50', icon: 'text-violet-500', badge: 'bg-violet-50 text-violet-600 border-violet-100/80' },
        { bg: 'from-rose-50 to-pink-50', border: 'border-rose-100/50', icon: 'text-rose-500', badge: 'bg-rose-50 text-rose-600 border-rose-100/80' }
    ];

    listEl.innerHTML = history.map((entry, idx) => {
        const [year, month] = entry.month.split('-');
        const monthDate = new Date(Number(year), Number(month) - 1, 1);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const color = monthColors[idx % monthColors.length];
        const isPositive = (entry.remaining || 0) >= 0;

        return `
        <div class="flex justify-between items-center py-3.5 px-5 group">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center ${color.border} border flex-shrink-0 shadow-sm">
                    <i data-lucide="calendar-check" class="w-4 h-4 ${color.icon}"></i>
                </div>
                <div>
                    <span class="font-bold text-slate-700 text-sm">${monthLabel}</span>
                    <div class="text-[10px] text-slate-400 font-medium">
                        Fund: ₹${(entry.totalFund || 0).toLocaleString('en-IN')} · Spent: ₹${(entry.totalSpent || 0).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>
            <span class="font-bold text-sm ${isPositive ? color.badge : 'bg-red-50 text-red-600 border-red-100/80'} px-2.5 py-1 rounded-lg border shadow-sm">
                ${isPositive ? '+' : ''}₹${(entry.remaining || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>`;
    }).join('');

    // Grand total row
    listEl.innerHTML += `
        <div class="flex justify-between items-center py-3.5 px-5 bg-gradient-to-r from-teal-50 to-emerald-50/80 rounded-b-2xl">
            <span class="font-bold text-slate-600 text-sm flex items-center gap-2">
                <div class="bg-teal-200/80 p-1.5 rounded-lg">
                    <span class="text-xs font-black text-teal-600">Σ</span>
                </div>
                Total Carry Forward
            </span>
            <span class="font-extrabold text-sm ${totalRemaining >= 0 ? 'text-teal-700' : 'text-red-600'} bg-white px-3 py-1.5 rounded-lg border border-teal-200/80 shadow-sm">₹${totalRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Member Fund Event Handlers ---
document.getElementById('add-money-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('add-money-modal');
    document.getElementById('add-money-member').value = '';
    document.getElementById('add-money-amount').value = '';
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

document.getElementById('cancel-add-money-btn')?.addEventListener('click', () => {
    document.getElementById('add-money-modal').classList.add('hidden');
});

document.getElementById('add-money-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = document.getElementById('add-money-member').value;
    const amount = parseFloat(document.getElementById('add-money-amount').value);
    if (!memberId || isNaN(amount) || amount <= 0) return;
    await addMemberMoney(memberId, amount);
    document.getElementById('add-money-modal').classList.add('hidden');
});

document.getElementById('cancel-edit-member-btn')?.addEventListener('click', () => {
    document.getElementById('edit-member-modal').classList.add('hidden');
});

document.getElementById('edit-member-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = document.getElementById('edit-member-id').value;
    const newTotal = parseFloat(document.getElementById('edit-member-total').value);
    if (!memberId || isNaN(newTotal) || newTotal < 0) return;
    await editMemberMoney(memberId, newTotal);
    document.getElementById('edit-member-modal').classList.add('hidden');
});

// --- Add to Fund (inline form in fund card) ---
document.getElementById('add-to-fund-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountInput = document.getElementById('add-to-fund-amount');
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>`;
    submitBtn.disabled = true;

    try {
        // Add amount to total fund only
        const fundRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_fund', 'summary');
        const newTotal = state.totalFund + amount;
        await setDoc(fundRef, {
            amount: newTotal,
            currentMonth: state.currentMonth || getCurrentMonthKey(),
            previousMonthSpent: state.previousMonthSpent,
            updatedBy: state.username,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Reset form
        amountInput.value = '';
        showToast(`₹${amount} added to fund`);
    } catch (err) {
        showToast('Failed to add to fund', 'error');
        console.error(err);
    } finally {
        submitBtn.innerHTML = originalHtml;
        submitBtn.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
});

initAuth();
