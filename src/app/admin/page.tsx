'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard when accessing /admin directly
    router.push('/admin/dashboard')
  }, [router])

  return null
}
