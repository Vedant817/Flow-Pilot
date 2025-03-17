'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUp() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const router = useRouter();
  const [error] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Add signup logic here
    // For now, just simulate a successful signup
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
      
      {/* Right side - Sign up form */}
      <div className="w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="w-[450px] bg-[#111827] p-8 rounded-lg">
          <h2 className="text-2xl font-bold text-white mb-6">Create an Account</h2>
          {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#00E676] text-black font-bold py-3 px-4 rounded-md hover:bg-opacity-90 transition-colors mt-6"
            >
              Create Account
            </button>
          </form>
          
          <p className="mt-6 text-sm text-gray-400 text-center">
            Already have an account? <a href="/sign-in" className="text-[#00E676] hover:underline">Sign In</a>
          </p>
        </div>
      </div>
    </div>
  );
}
