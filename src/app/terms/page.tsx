import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: April 27, 2026</p>

        <div className="mt-8 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By using EduScan, you agree to follow these terms and all applicable school policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Account Responsibility</h2>
            <p className="mt-2">
              You are responsible for keeping your login credentials secure and for activities performed under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Acceptable Use</h2>
            <p className="mt-2">
              You must use EduScan only for legitimate educational and attendance-related purposes. Unauthorized access, data misuse,
              and disruptive behavior are prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Data Accuracy</h2>
            <p className="mt-2">
              Users should keep personal and attendance-related information accurate. The school may review and correct records when necessary.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Changes to the Service</h2>
            <p className="mt-2">
              The school may update or modify system features, policies, and these terms to improve service and compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Contact</h2>
            <p className="mt-2">
              For questions about these terms, contact the school administration.
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
