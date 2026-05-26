import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

export const isFirebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_DATABASE_URL
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseDb: any = null

if (isFirebaseConfigured) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  })
  firebaseDb = getDatabase(app)
}

export { firebaseDb as db }
