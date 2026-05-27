import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../config/supabase'
import type { User } from '@supabase/supabase-js'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/social-cricket-scorer/`,
      },
    })
  }

  async function signOut() {
    if (!isSupabaseConfigured) return
    await supabase.auth.signOut()
  }

  const isAdmin = Boolean(user && ADMIN_EMAIL && user.email === ADMIN_EMAIL)

  return { user, isAdmin, loading, signInWithGoogle, signOut }
}
