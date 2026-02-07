# 🔐 Mess Manager - Access Instructions

## For Mess Members

### How to Get Access

Your mess uses **Mess Manager** for expense tracking. Access is restricted to authorized members only.

---

### ✅ If You're Already Authorized

1. Visit: **[Your Mess Manager URL]**
2. Click **"Continue with Google"**
3. Sign in with your authorized Gmail account
4. You'll see the dashboard immediately

---

### ❌ If You See "Access Denied"

**This means your email is not yet authorized.**

**Steps to get access:**

1. Contact your mess admin/manager
2. Provide your **Gmail address** (the one you used to sign in)
3. Admin will add your email to the authorized list
4. Try signing in again after confirmation

---

### 📧 Common Issues

**Q: I'm using the right email but still can't access**
- **A:** Wait a few minutes after admin adds you, then try again
- Clear your browser cache/cookies and retry
- Make sure you're using the exact email that was authorized

**Q: Can I use multiple emails?**
- **A:** Each email must be separately authorized by admin
- Best to stick with one Gmail account for consistency

**Q: Why do we need authorization?**
- **A:** To prevent random people from adding fake expenses
- Ensures only mess members can view/modify data
- Protects your financial records

---

### 🎯 What You Can Do Once Authorized

✅ View all mess expenses in real-time  
✅ Add new expenses (items you purchased)  
✅ Edit/delete your own expenses  
✅ See daily and monthly spending summaries  
✅ Download PDF reports  
✅ Track fund balance  

❌ You cannot delete expenses added by others  
❌ You must be logged in to access any data  

---

## For Mess Admin

### How to Add New Members

1. **Edit `script.js`:** Add member's email to `AUTHORIZED_EMAILS` array
2. **Edit `firestore.rules`:** Add same email to `isAuthorizedUser()` function
3. **Deploy changes:** Push to hosting & deploy Firestore rules
4. **Notify member:** Tell them they can now sign in

**Example:**
```javascript
// script.js
const AUTHORIZED_EMAILS = [
    'admin@gmail.com',
    'newmember@gmail.com',  // ← Add here
];

// firestore.rules
function isAuthorizedUser() {
  return request.auth != null && (
    request.auth.token.email.lower() == 'admin@gmail.com'
    || request.auth.token.email.lower() == 'newmember@gmail.com'  // ← Add here
  );
}
```

📖 Full guide: [SECURITY_SETUP.md](SECURITY_SETUP.md)

---

### Emergency Contact

**Mess Admin:** [Your Name]  
**Email:** [Your Email]  
**Phone:** [Your Phone] (for urgent access issues)

---

**Mess Manager** - Smart expense tracking for your group 🍽️
