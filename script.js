import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, initializeFirestore, setDoc, getDoc 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signOut 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// --- Configuration from Environment Variables ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC7z-IuvKCSer2rTRatJW5DRtO9NDZdPeg",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "messjyotirmoy.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "messjyotirmoy",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "messjyotirmoy.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "13122110126",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:13122110126:web:bb6d03aa476dbf5929a33f"
};

const appId = import.meta.env.VITE_APP_ID || 'default-app-id';

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
    user: null, username: '', userPhoto: '', expenses: [], totalFund: 0, editId: null, deleteTargetId: null, loading: true, hasJoined: false, viewMode: 'daily', currentMonth: '', previousMonthSpent: 0
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
    prevMonthInfo: document.getElementById('prev-month-info'), prevMonthSpent: document.getElementById('prev-month-spent')
};

// --- STANDARD LOGIC ---

async function initAuth() {
    if (firebaseConfig.apiKey === "PASTE_API_KEY_HERE") {
        state.loading = false; render(); 
        setTimeout(() => showError("Config Error: Update index.html with keys.", true), 100); return;
    }
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e) { }
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

onAuthStateChanged(auth, (user) => {
    state.user = user;
    if (user) {
        state.username = user.displayName || (user.email ? user.email.split('@')[0] : 'Guest');
        state.userPhoto = user.photoURL;
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
        // Calculate total spent for all expenses
        const totalSpent = state.expenses.reduce((acc, curr) => acc + (curr.cost || 0), 0);
        
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
            
            showToast(`Month changed! Previous month spent: ₹${totalSpent.toLocaleString('en-IN')}`);
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

document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) { state.deleteTargetId = deleteBtn.dataset.id; elements.deleteModal.classList.remove('hidden'); return; }
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        const id = editBtn.dataset.id; const expense = state.expenses.find(x => x.id === id);
        if (expense) { state.editId = id; elements.itemName.value = expense.item; elements.itemCost.value = expense.cost; updateFormState(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
});

elements.cancelDeleteBtn.addEventListener('click', () => { state.deleteTargetId = null; elements.deleteModal.classList.add('hidden'); });
elements.confirmDeleteBtn.addEventListener('click', async () => {
    if (!state.deleteTargetId) return;
    const originalText = elements.confirmDeleteBtn.innerHTML;
    elements.confirmDeleteBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>`;
    try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_expenses', state.deleteTargetId);
        await deleteDoc(docRef); elements.deleteModal.classList.add('hidden');
    } catch(err) { showError(`Delete Failed.`, false); elements.deleteModal.classList.add('hidden'); } 
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
        renderDashboardData(); 
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
    
    elements.totalSpent.textContent = `₹${totalSpent.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    elements.totalFund.textContent = `₹${state.totalFund.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    elements.fundBalance.textContent = `₹${remaining.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    
    // Display previous month spent if available
    if (state.previousMonthSpent && state.previousMonthSpent > 0) {
        elements.prevMonthInfo.classList.remove('hidden');
        elements.prevMonthSpent.textContent = `₹${state.previousMonthSpent.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    } else {
        elements.prevMonthInfo.classList.add('hidden');
    }
    
    if(remaining < 0) { elements.fundBalance.classList.remove('from-emerald-200', 'to-teal-100'); elements.fundBalance.classList.add('text-red-300'); } 
    else { elements.fundBalance.classList.add('from-emerald-200', 'to-teal-100'); elements.fundBalance.classList.remove('text-red-300'); }

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

    elements.expensesList.innerHTML = keys.map(key => {
        const group = grouped[key];
        const itemsHtml = group.items.map(expense => `
            <div class="flex justify-between items-center py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 px-5 transition group">
                <div class="flex-1">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-slate-700 text-sm">${escapeHtml(expense.item)}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                        ${expense.userPhoto ? `<img src="${expense.userPhoto}" class="w-4 h-4 rounded-full shadow-sm">` : `<div class="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center"><i data-lucide="user" class="w-2.5 h-2.5 text-slate-500"></i></div>`} 
                        <span class="text-[11px] font-medium text-slate-400">${escapeHtml(expense.addedBy)}</span>
                        <span class="text-[10px] text-slate-300">•</span>
                        <span class="text-[11px] text-slate-400">${new Date(expense.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <span class="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">₹${expense.cost.toLocaleString('en-IN')}</span>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="edit-btn p-1.5 hover:bg-blue-50 rounded text-blue-500 transition" data-id="${expense.id}"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                        <button class="delete-btn p-1.5 hover:bg-red-50 rounded text-red-500 transition" data-id="${expense.id}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            </div>`).join('');
        return `
            <div class="fade-in glass-card rounded-2xl overflow-hidden mb-4 border border-white/60">
                <div class="bg-slate-50/80 backdrop-blur-sm px-5 py-3 flex justify-between items-center border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <div class="bg-white p-1.5 rounded-lg shadow-sm">
                            <i data-lucide="${state.viewMode === 'daily' ? 'calendar' : 'calendar-days'}" class="w-4 h-4 text-slate-400"></i>
                        </div>
                        <span class="text-xs font-bold text-slate-600 uppercase tracking-wide">${group.label}</span>
                    </div>
                    <span class="text-slate-600 font-bold text-xs bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">Total: ₹${group.total.toLocaleString('en-IN')}</span>
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
        btnText.innerText = "Update Entry"; formTitle.innerHTML = `<i data-lucide="edit-2" class="w-5 h-5 text-blue-500"></i><span class="text-blue-600">Edit Item</span>`;
        if (elements.cancelEditBtn) elements.cancelEditBtn.classList.remove('hidden');
    } else {
        submitBtn.classList.replace('from-blue-600', 'from-emerald-600'); submitBtn.classList.replace('to-indigo-600', 'to-teal-600');
        btnText.innerText = "Add Item"; formTitle.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-emerald-500"></i><span>Add Expense</span>`;
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
function escapeHtml(text) { if (!text) return ''; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function showToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl text-white text-sm font-bold fade-in z-50 flex items-center gap-2 ${type === 'success' ? 'bg-slate-800' : 'bg-red-500'}`;
    toast.innerHTML = type === 'success' ? `<i data-lucide="check-circle" class="w-4 h-4"></i> ${msg}` : `<i data-lucide="alert-circle" class="w-4 h-4"></i> ${msg}`;
    document.body.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => toast.remove(), 3000);
}

initAuth();
