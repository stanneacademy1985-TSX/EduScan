'use client'

import Link from 'next/link'
import { useRef } from 'react'

export default function MobileNavMenu() {
  const menuRef = useRef<HTMLDetailsElement>(null)

  const closeMenu = () => {
    if (menuRef.current) {
      menuRef.current.open = false
    }
  }

  return (
    <details ref={menuRef} className="sm:hidden relative">
      <summary className="list-none cursor-pointer px-3 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium select-none">
        Menu
      </summary>
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg p-2">
        <Link
          href="/login"
          onClick={closeMenu}
          className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
        >
          Login
        </Link>
        <Link
          href="/register"
          onClick={closeMenu}
          className="block w-full text-left mt-1 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white"
        >
          Register
        </Link>
      </div>
    </details>
  )
}
