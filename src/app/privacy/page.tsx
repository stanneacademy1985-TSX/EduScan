import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: April 27, 2026</p>

        <div className="mt-8 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Information We Collect</h2>
            <p className="mt-2">
              EduScan stores student and staff account details, attendance records, and related school information required for system operation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. How We Use Information</h2>
            <p className="mt-2">
              Information is used for attendance tracking, academic administration, account management, and official school reporting.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Data Sharing</h2>
            <p className="mt-2">
              Data is shared only with authorized school personnel and trusted service providers needed to operate EduScan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Data Security</h2>
            <p className="mt-2">
              The system uses technical and organizational safeguards to protect account and attendance information from unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Data Retention</h2>
            <p className="mt-2">
              Records are retained according to school policy and legal requirements, then securely archived or removed as appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Your Rights</h2>
            <p className="mt-2">
              You may request correction of inaccurate personal information through the school administration.
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  )
}
