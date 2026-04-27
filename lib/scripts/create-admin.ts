import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY // You need this!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createAdmin() {
  const email = 'markjoheunkim24@gmail.com'
  const password = 'Pizza123@'
  const fullName = 'Mark Joheun Kim'
  
  try {
    // Hash the password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    
    console.log('Creating admin user with:')
    console.log('Email:', email)
    console.log('Hashed Password:', hashedPassword)
    
    // Insert into database
    const { data, error } = await supabase
      .from('admin_users')
      .insert([
        {
          email: email,
          password_hash: hashedPassword,
          full_name: fullName,
          role: 'admin',
          is_active: true
        }
      ])
      .select()
    
    if (error) {
      console.error('Error creating admin:', error)
      return
    }
    
    console.log('✅ Admin user created successfully!')
    console.log('Admin details:', data)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

createAdmin()