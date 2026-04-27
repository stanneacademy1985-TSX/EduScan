import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduScan | QR Attendance System',
  description: 'IoT-Based QR Code Attendance and Student Information Management System',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50">
        {/* Background pattern */}
        <div className="fixed inset-0 -z-10 h-full w-full">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px]"></div>
          <div className="absolute inset-0 bg-linear-to-br from-blue-50/50 via-transparent to-purple-50/50"></div>
        </div>
        {children}
      </body>
    </html>
  )
}