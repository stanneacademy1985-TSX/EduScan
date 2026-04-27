import Link from 'next/link'
import Image from 'next/image'
import MobileNavMenu from './_components/mobile-nav-menu'
import { QrCode, Shield, Cloud, BarChart, Smartphone, Zap, CheckCircle, Users, Calendar, Download } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation - Made taller */}
      <nav className="bg-white/95 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:py-0 sm:h-24"> {/* Increased to h-24 */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0"> {/* Increased gap */}
              {/* Logo Image - Fixed sizing */}
              <div className="flex items-center justify-center">
                <Image
                  src="/logo.png" 
                  alt="EduScan Logo"
                  width={85}
                  height={85} 
                  className="w-12 h-12 sm:w-[85px] sm:h-[85px] object-contain"
                  priority
                />
              </div>
              <span className="font-bold text-base max-[360px]:text-sm sm:text-2xl text-gray-800 text-left leading-tight truncate">
                St. Anne's Academy EduScan
              </span>
            </div>
            
            <div className="hidden sm:flex items-center gap-3 sm:gap-6">
              <Link
                href="/login"
                className="text-center px-4 sm:px-6 py-2.5 sm:py-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors font-medium text-sm sm:text-base"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-center px-5 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-md text-sm sm:text-base"
              >
                Register
              </Link>
            </div>

            <MobileNavMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-2 sm:py-5">
        {/* Background Image with overlay */}
        <div className="absolute inset-0">
          <Image
            src="/stanne.jpg"
            alt="Technology background"
            fill
            className="object-cover blur-md opacity-50"
            priority
            quality={85}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-blue-900/5 to-purple-900/20"></div>
        </div>
        
        {/* Pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-14 sm:pb-20">
          <div className="text-center">
            {/* Main heading */}
            <h1 className="text-4xl max-[360px]:text-3xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
              <span className="block text-gray-800">IoT-Based</span>
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                QR Attendance System
              </span>
            </h1>
            
            <p className="text-base sm:text-xl text-gray-700 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed px-1">
              A modern, efficient attendance management system using QR codes, AI, and cloud technologies.
              Streamline student attendance with instant QR codes and real-time tracking.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 max-w-md sm:max-w-none mx-auto">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <QrCode className="w-5 h-5" />
                Get Started as Student
                <span className="inline-block ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-blue-600 border-2 border-blue-200 font-semibold rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group shadow-sm"
              >
                Student Login
                <span className="inline-block ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200/50">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">99.9%</div>
                <div className="text-sm text-gray-700">Accuracy Rate</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200/50">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2">Instant</div>
                <div className="text-sm text-gray-700">QR Generation</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200/50">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">24/7</div>
                <div className="text-sm text-gray-700">Cloud Access</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200/50">
                <div className="text-2xl sm:text-3xl font-bold text-amber-600 mb-2">Real-time</div>
                <div className="text-sm text-gray-700">Tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14 sm:py-20 bg-white/80 relative">
        {/* Background pattern for features */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30"></div>
          <div className="absolute inset-0 opacity-10"
               style={{
                 backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2364748b' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                 backgroundSize: '60px 60px'
               }}>
          </div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
              Everything You Need for
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Modern Attendance</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-700 max-w-3xl mx-auto">
              A comprehensive solution designed for schools and students
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {/* Feature 1 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
                <QrCode className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Instant QR Codes</h3>
              <p className="text-gray-700">
                Each student receives a unique QR code immediately after registration for quick attendance marking.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mb-6">
                <Smartphone className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Mobile Ready</h3>
              <p className="text-gray-700">
                Access the system from any device. Students can present QR codes directly from their smartphones.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6">
                <BarChart className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Real-time Analytics</h3>
              <p className="text-gray-700">
                Monitor attendance patterns with detailed reports, statistics, and real-time dashboards.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Secure & Reliable</h3>
              <p className="text-gray-700">
                Enterprise-grade security with encrypted QR codes and secure cloud storage for all data.
              </p>
            </div>
            
            {/* Feature 5 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mb-6">
                <Cloud className="w-7 h-7 text-cyan-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Cloud Powered</h3>
              <p className="text-gray-700">
                All data securely stored in the cloud with automatic backups, sync, and multi-device access.
              </p>
            </div>
            
            {/* Feature 6 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-pink-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Fast & Efficient</h3>
              <p className="text-gray-700">
                Process attendance in seconds with our optimized scanning system and instant validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 sm:py-20 bg-gradient-to-br from-blue-50 to-indigo-50 relative">
        {/* Background image for this section */}
        <div className="absolute inset-0">
          <Image
            src="/stanne.jpg"
            alt="Data analytics background"
            fill
            className="object-cover opacity-10"
            quality={85}
          />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
              How It
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Works</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-700 max-w-3xl mx-auto">
              Simple three-step process for seamless attendance management
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">Register & Get QR</h3>
                <p className="text-gray-700 mb-6">
                  Students register with their details and instantly receive a unique QR code.
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <Users className="w-5 h-5" />
                  <span>Student Registration</span>
                </div>
              </div>
              <div className="hidden lg:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                <div className="w-8 h-8 border-t-2 border-r-2 border-blue-300 transform rotate-45"></div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">Scan for Attendance</h3>
                <p className="text-gray-700 mb-6">
                  Present your QR code for scanning during class for instant attendance marking.
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <QrCode className="w-5 h-5" />
                  <span>Quick Scanning</span>
                </div>
              </div>
              <div className="hidden lg:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                <div className="w-8 h-8 border-t-2 border-r-2 border-blue-300 transform rotate-45"></div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="sm:col-span-2 lg:col-span-1 bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Track & Monitor</h3>
              <p className="text-gray-700 mb-6">
                View real-time attendance records, statistics, and reports on your dashboard.
              </p>
              <div className="flex items-center gap-2 text-blue-600 font-medium">
                <BarChart className="w-5 h-5" />
                <span>Real-time Tracking</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-14 sm:py-20 bg-white relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5"
             style={{
               backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%2364748b' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E\")",
               backgroundSize: '100px 100px'
             }}>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
              Why Choose
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> EduScan?</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-700 max-w-3xl mx-auto">
              Experience the future of attendance management with our innovative features
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 sm:gap-8">
            {/* Left side - Benefits */}
            <div className="space-y-4 sm:space-y-6">
              {[
                { icon: CheckCircle, color: 'text-green-500', title: 'Time-Saving', desc: 'Reduce attendance time by 90% with instant QR scanning' },
                { icon: Shield, color: 'text-blue-500', title: 'Fraud Prevention', desc: 'Unique QR codes prevent proxy attendance and manipulation' },
                { icon: Calendar, color: 'text-purple-500', title: 'Automated Records', desc: 'Automatically generate attendance reports and analytics' },
                { icon: Download, color: 'text-amber-500', title: 'Easy Export', desc: 'Download attendance data in multiple formats (PDF, Excel)' },
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-3 sm:gap-4 p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-gray-200 hover:bg-white transition-colors">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${benefit.color.replace('text-', 'bg-')}/10`}>
                    <benefit.icon className={`w-6 h-6 ${benefit.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{benefit.title}</h3>
                    <p className="text-gray-700">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right side - Preview */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-10"
                   style={{
                     backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                     backgroundSize: '60px 60px'
                   }}>
              </div>
              
              <div className="relative z-10">
                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-bold mb-3">Live Dashboard Preview</h3>
                  <p className="text-blue-100">See what your student dashboard will look like</p>
                </div>

                {/* Mock Dashboard */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Student Dashboard</h4>
                      <p className="text-blue-100 text-sm">Real-time attendance tracking</p>
                    </div>
                  </div>

                  {/* Mock Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold">95%</div>
                      <div className="text-blue-100 text-sm">Attendance Rate</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl font-bold">48</div>
                      <div className="text-blue-100 text-sm">Classes Attended</div>
                    </div>
                  </div>

                  {/* Mock QR Code */}
                  <div className="flex justify-center">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-xl p-3 sm:p-4">
                      <div className="w-full h-full border-4 border-dashed border-blue-300 rounded flex items-center justify-center">
                        <QrCode className="w-16 h-16 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-blue-100 text-sm mt-4">
                    Your personalized dashboard awaits
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-14 sm:py-20 bg-gradient-to-br from-blue-50 to-indigo-50 relative">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/stanne.jpg"
            alt="Technology network background"
            fill
            className="object-cover opacity-15"
            quality={85}
          />
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl p-7 sm:p-12 shadow-2xl relative overflow-hidden">
            {/* Pattern overlay */}
            <div className="absolute inset-0 opacity-10"
                 style={{
                   backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                   backgroundSize: '60px 60px'
                 }}>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Ready to Transform Your Attendance Experience?
              </h2>
              <p className="text-blue-100 mb-8 text-base sm:text-lg">
                Join thousands of students already using EduScan for seamless, modern attendance management.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <QrCode className="w-5 h-5" />
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors border border-white/30"
                >
                  Access Your Account
                </Link>
              </div>
              <p className="text-blue-100/80 text-sm mt-6">
                No credit card required • Setup in minutes • Free for students
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 sm:py-12 relative">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
             style={{
               backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
               backgroundSize: '60px 60px'
             }}>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-4">
            <div className="mb-0">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="font-bold text-xl">EduScan</span>
              </div>
              <p className="text-gray-400 max-w-md">
                IoT-Based QR Code Attendance and Student Information Management System with AI and Cloud Technologies.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors font-medium">
                Student Login
              </Link>
              <Link href="/register" className="text-gray-300 hover:text-white transition-colors font-medium">
                Student Registration
              </Link>
              <Link href="/student/dashboard" className="text-gray-300 hover:text-white transition-colors font-medium">
                Dashboard Demo
              </Link>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
              <div className="text-gray-500 text-sm mb-0">
                <p>© {new Date().getFullYear()} EduScan Attendance System. All rights reserved.</p>
              </div>
              <div className="text-gray-500 text-sm">
                <p>Grade 11-12 • Saint Anne SHS • LRN-based Registration</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}