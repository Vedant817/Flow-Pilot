'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Add sign-in logic here
    // For now, just simulate a successful sign-in
    router.push('/');
  };

  return (
    <div className="h-screen w-screen flex flex-row bg-black overflow-hidden">
      {/* Left side - Branding and background */}
      <div className="w-1/2 bg-gradient-to-br from-black to-gray-900 flex flex-col justify-between relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#00E676] rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#00E676] rounded-full filter blur-3xl"></div>
        </div>
        
        <div className="p-12 z-10">
          <div className="mt-20">
            <h1 className="text-4xl font-bold text-white mb-4">Automated Order Processing System</h1>
            <p className="text-gray-400 text-xl max-w-md">Track, manage, and optimize your electronics inventory with our powerful dashboard.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 p-12 z-10">
          <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-800">
            <h3 className="text-[#00E676] font-medium mb-1">Real-time Tracking</h3>
            <p className="text-gray-400 text-sm">Monitor stock levels and get alerts when inventory runs low</p>
          </div>
          <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-800">
            <h3 className="text-[#00E676] font-medium mb-1">Analytics</h3>
            <p className="text-gray-400 text-sm">Gain insights with powerful reporting and forecasting tools</p>
          </div>
        </div>
      </div>
      
      {/* Right side - Sign in form */}
      <div className="w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="w-[450px] bg-[#111827] p-8 rounded-lg">
          <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-700 bg-black text-[#00E676] focus:ring-[#00E676]"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="text-[#00E676] hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-[#00E676] text-black font-bold py-3 px-4 rounded-md hover:bg-opacity-90 transition-colors mt-6"
            >
              Sign In
            </button>
          </form>
          
          <p className="mt-6 text-sm text-gray-400 text-center">
            Don&apos;t have an account? <a href="/sign-up" className="text-[#00E676] hover:underline">Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
