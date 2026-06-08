@echo off
title Mess Manager Mobile App - Expo Server
color 0A
echo =========================================================
echo  🎯 Mess Manager - React Native + Expo Mobile Server
echo  📁 Working Directory: mess-manager-app
echo  ⚡ Expo SDK: 54
echo =========================================================
echo.
echo  Starting Metro Bundler...
echo.
cd /d "%~dp0mess-manager-app"
npx expo start
pause
