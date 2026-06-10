import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  console.log('Testing sign in...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@apldms.local',
    password: 'admin123'
  })
  
  if (authError) {
    console.log('Sign in failed:', authError.message)
  } else {
    console.log('Sign in success! User:', authData.user?.id, 'Email:', authData.user?.email)
  }

  console.log('Fetching profiles...')
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('*')
  console.log('Profiles:', profiles, 'Error:', profileError)

  console.log('Fetching roles...')
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*')
  console.log('Roles Count:', roles?.length, 'Roles:', roles)
}
check()
