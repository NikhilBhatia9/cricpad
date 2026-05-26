# Firebase Setup Guide

Live match sharing requires a free Firebase Realtime Database. Setup takes ~5 minutes.

## 1. Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → enter a name (e.g. `cricket-scorer`) → Continue
3. Disable Google Analytics (not needed) → **Create project**

## 2. Create a Realtime Database

1. In the left sidebar: **Build → Realtime Database**
2. Click **Create Database**
3. Choose a location (closest to you) → **Next**
4. Select **Start in test mode** → **Enable**
   - Test mode allows open read/write for 30 days (sufficient for personal use)
   - For permanent use, change rules to:
     ```json
     {
       "rules": {
         "rooms": {
           "$code": {
             ".read": true,
             ".write": true
           }
         }
       }
     }
     ```

## 3. Get your config

1. Go to **Project Settings** (gear icon) → **General** tab
2. Scroll to **Your apps** → click **</>** (Web)
3. Register the app (any nickname) → **Register app**
4. Copy the `firebaseConfig` values — you need:
   - `apiKey`
   - `authDomain`
   - `databaseURL` ← **important: must be the Realtime Database URL**
   - `projectId`

## 4. Add secrets to GitHub

1. Go to your repo: **Settings → Secrets and variables → Actions**
2. Add these repository secrets:

| Secret name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | your `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | your `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | your `databaseURL` (e.g. `https://your-project-default-rtdb.firebaseio.com`) |
| `VITE_FIREBASE_PROJECT_ID` | your `projectId` |

## 5. Redeploy

Push any small commit (or re-run the latest Actions workflow manually) to trigger a new build with the Firebase config baked in.

## How it works

- The **scorer** taps **🔗 Share** on the scoring screen → a 6-character room code is generated
- Others tap **🔗 Join a Match** on the home screen → enter the code → they see the live match
- Any participant can record balls — all devices sync in real time via Firebase
- Room data is just the match JSON, overwritten on each ball event
