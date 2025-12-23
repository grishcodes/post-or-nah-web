@echo off
title Stripe Payment Server - Auto Restart
echo 🚀 Starting Stripe Payment Server with Auto-Restart...
echo Press Ctrl+C to stop completely

:start
echo.
echo ⏰ %date% %time% - Starting server...
node stripe-payment-server.cjs
echo.
echo ⚠️  Server stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto start