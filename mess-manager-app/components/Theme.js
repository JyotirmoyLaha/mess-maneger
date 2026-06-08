export const Colors = {
  background: '#080c14', // Deep premium black-slate
  cardBg: 'rgba(17, 24, 39, 0.7)', // Semi-transparent slate-900 card
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8', // Slate 400
  textMuted: '#64748b', // Slate 500
  
  // Emerald / Green Shades
  emerald: '#10b981',
  emeraldLight: 'rgba(16, 185, 129, 0.12)',
  emeraldBorder: 'rgba(16, 185, 129, 0.25)',
  
  teal: '#059669', // Rich Forest Green
  tealLight: 'rgba(5, 150, 105, 0.12)',
  
  cyan: '#10b981', // mapped to emerald
  cyanLight: 'rgba(16, 185, 129, 0.12)',

  // Crimson / Red Shades
  red: '#ef4444',
  redLight: 'rgba(239, 68, 68, 0.12)',
  redBorder: 'rgba(239, 68, 68, 0.25)',
  
  amber: '#ef4444', // mapped to red
  amberLight: 'rgba(239, 68, 68, 0.12)',
  amberBorder: 'rgba(239, 68, 68, 0.25)',
  
  // Backward compatibility redirects for blue & purple (which are now emerald green)
  blue: '#10b981',
  blueLight: 'rgba(16, 185, 129, 0.12)',
  blueBorder: 'rgba(16, 185, 129, 0.25)',
  
  purple: '#10b981',
  purpleLight: 'rgba(16, 185, 129, 0.12)',
  purpleBorder: 'rgba(16, 185, 129, 0.25)',
  
  overlay: 'rgba(8, 12, 20, 0.75)',
  white: '#ffffff',
  whiteTrans: 'rgba(255, 255, 255, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.05)',
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};
