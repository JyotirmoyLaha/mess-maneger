# Setup Instructions

## Environment Configuration

Your project now uses environment variables to securely manage Firebase API keys. Follow these steps:

### 1. Copy the Environment Template
```bash
cp .env.example .env
```

### 2. Fill in Your Credentials
Edit the `.env` file with your Firebase project credentials:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
VITE_APP_ID=default-app-id
```

### 3. Security
- The `.env` file is **automatically ignored** by Git (see `.gitignore`)
- Your API keys will **never be committed** to GitHub
- Only `.env.example` is tracked in version control

## File Structure

```
mess-maneger/
├── index.html          # HTML markup
├── styles.css          # All CSS (animations, layouts, styling)
├── script.js           # JavaScript logic (Firebase, event handlers)
├── .env                # Private credentials (NOT in GitHub)
├── .env.example        # Template for developers
├── .gitignore          # Prevents .env from being tracked
└── manifest.json       # PWA configuration
```

## Running Locally

Simply open `index.html` in your browser. The app will:
1. Load styles from `styles.css`
2. Load JavaScript from `script.js`
3. Read Firebase config from `.env` (using `import.meta.env.VITE_*`)
4. Run with full functionality

## Deploying

When deploying to production:
1. Ensure `.env` is **not** committed to version control
2. Set environment variables in your hosting platform:
   - Vercel: Settings → Environment Variables
   - Netlify: Settings → Build & Deploy → Environment
   - GitHub Pages: Use GitHub Secrets (requires build step)
3. Never expose API keys in client-side code

## What Changed?

### Before
- Single 870-line `mess.animation.html` file
- Inline CSS and JavaScript
- Firebase API keys visible in source code

### After
- Modular structure: separate HTML, CSS, JS
- Environment variables for secure API key management
- `.gitignore` prevents accidental commits
- `.env.example` serves as documentation

## Important Notes

⚠️ **Never commit `.env` file to GitHub**
⚠️ **Always use `.env.example` as a template**
⚠️ **Keep `VITE_` prefix for environment variables**

