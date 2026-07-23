@echo off
cd /d C:\Users\todd_\traveldoss-bugbash
if "%PORT%"=="" set PORT=8081
npm run dev -- --port %PORT% --strictPort
