# Mess Manager 🍽️

A beautiful and intuitive Progressive Web App (PWA) for tracking shared expenses in mess halls, hostels, or any group living situation. Built with modern web technologies and featuring a stunning animated UI.

## ✨ Features

- **Smart Expense Tracking**: Add, edit, and delete expense entries with ease
- **Real-time Sync**: All data syncs in real-time across all devices using Firebase
- **Google Authentication**: Secure sign-in with Google accounts
- **Fund Management**: Set and track total collected funds vs. spent amounts
- **Visual Analytics**: View expenses by daily or monthly periods
- **User Attribution**: See who added each expense with profile photos
- **Responsive Design**: Works beautifully on mobile, tablet, and desktop
- **Premium UI**: Animated gradient background with floating particles
- **Glass Morphism**: Modern glassmorphic card designs
- **PWA Support**: Install as an app on your device for offline access
- **Real-time Balance**: Instantly see remaining funds and total spent

## 🎨 Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Icons**: Lucide Icons
- **Backend**: Firebase
  - Firebase Authentication (Google Sign-in)
  - Cloud Firestore (Database)
- **Fonts**: Plus Jakarta Sans
- **Architecture**: Single Page Application (SPA)

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A Firebase account (free tier works fine)
- A web server to host the application (can use GitHub Pages, Netlify, Vercel, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JyotirmoyLaha/mess-maneger.git
   cd mess-maneger
   ```

2. **Set up Firebase**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use an existing one
   - Enable Google Authentication:
     - Go to Authentication > Sign-in method
     - Enable Google provider
   - Create a Firestore database:
     - Go to Firestore Database
     - Create database in production mode
   - Get your Firebase configuration:
     - Go to Project Settings > General
     - Scroll to "Your apps" section
     - Click on Web app (</>)
     - Copy the Firebase configuration object

3. **Configure the application**
   - Open `index.html` in a text editor
   - Find the Firebase configuration section (around line 406)
   - Replace the existing `firebaseConfig` object with your Firebase configuration:
     ```javascript
     firebaseConfig = {
         apiKey: "YOUR_API_KEY",
         authDomain: "YOUR_AUTH_DOMAIN",
         projectId: "YOUR_PROJECT_ID",
         storageBucket: "YOUR_STORAGE_BUCKET",
         messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
         appId: "YOUR_APP_ID"
     };
     ```

4. **Configure authorized domains**
   - In Firebase Console, go to Authentication > Settings > Authorized domains
   - Add your domain (e.g., `yourdomain.com` or `localhost` for testing)

5. **Deploy the application**
   
   **Option A: GitHub Pages**
   - Push your code to GitHub
   - Go to repository Settings > Pages
   - Select the branch and save
   - Your app will be available at `https://yourusername.github.io/mess-maneger/`

   **Option B: Local Testing**
   - Use a local web server (e.g., Python's http.server):
     ```bash
     python -m http.server 8000
     ```
   - Open `http://localhost:8000` in your browser

   **Option C: Netlify/Vercel**
   - Connect your GitHub repository
   - Deploy with one click

## 📱 Usage

### First Time Setup

1. Open the application in your browser
2. Click "Continue with Google" to sign in
3. Allow the necessary permissions
4. You'll be redirected to the dashboard

### Managing Funds

1. Click the edit button (✏️) next to "Total Fund"
2. Enter the total amount collected from all members
3. Click "Save"

### Adding Expenses

1. In the "Add Expense" section:
   - Enter what you bought (e.g., "Groceries", "Rice", "Vegetables")
   - Enter the cost
   - Click "Add Item"
2. The expense will appear in the list below

### Editing Expenses

1. Hover over any expense item
2. Click the blue edit button (✏️)
3. Modify the details in the form
4. Click "Update Entry"

### Deleting Expenses

1. Hover over any expense item
2. Click the red trash button (🗑️)
3. Confirm deletion in the modal

### Viewing Expenses

- Toggle between "Daily" and "Monthly" views using the buttons at the top of the expense list
- Daily view groups expenses by date
- Monthly view groups expenses by month
- Each group shows the total spent for that period

## 🏗️ Project Structure

```
mess-maneger/
├── index.html          # Main application file (contains HTML, CSS, and JS)
├── manifest.json       # PWA manifest (if exists)
└── README.md          # This file
```

## 🔒 Security Notes

- **Never commit your Firebase API keys** to public repositories
- The API key in the code is client-side and protected by Firebase Security Rules
- Configure Firestore Security Rules to restrict access as needed
- Example Firestore rules:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /artifacts/{appId}/public/data/{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```

## 🎯 Features Breakdown

### Real-time Synchronization
All expense data is stored in Firestore and syncs in real-time. When one user adds an expense, all other users see it immediately without refreshing.

### User Profiles
Each expense shows:
- Who added it (username)
- Their profile photo (from Google account)
- When it was added (date and time)

### Smart Balance Calculation
The app automatically calculates:
- Total amount spent
- Remaining balance (Total Fund - Total Spent)
- Visual indicators (red text when over budget)

### Responsive Design
- Mobile-first design
- Adapts to all screen sizes
- Touch-friendly buttons and interactions

## 🎨 Customization

### Changing Colors
The color scheme uses Tailwind CSS classes. Main colors:
- Primary: Emerald/Teal (`emerald-500`, `teal-600`)
- Backgrounds: Slate (`slate-800`, `slate-900`)
- Accents: Blue, Red for actions

### Modifying Animations
Animations are defined in the `<style>` section:
- `gradientMove`: Background gradient animation
- `floatUp`: Particle floating animation
- `fadeIn`: Element fade-in animation

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Future Enhancements

- [ ] Export expenses to CSV/Excel
- [ ] Generate monthly reports
- [ ] Add expense categories
- [ ] Multi-currency support
- [ ] Dark mode toggle
- [ ] Budget alerts and notifications
- [ ] Split expenses among members
- [ ] Receipt upload functionality
- [ ] Backup and restore data

## 🐛 Known Issues

- Requires internet connection for authentication and real-time sync
- Long polling is used for Firestore (for better mobile compatibility)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Author

**Jyotirmoy Laha**
- GitHub: [@JyotirmoyLaha](https://github.com/JyotirmoyLaha)

## 🙏 Acknowledgments

- Icons by [Lucide](https://lucide.dev/)
- Fonts by [Google Fonts](https://fonts.google.com/)
- Styling by [Tailwind CSS](https://tailwindcss.com/)
- Backend by [Firebase](https://firebase.google.com/)

---

Made with ❤️ for making shared expense tracking simple and beautiful.
