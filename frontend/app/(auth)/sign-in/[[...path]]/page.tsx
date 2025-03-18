'use client'
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex h-full w-full bg-black overflow-hidden">
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
      
      <div className="w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-8">
        <div className="w-full max-w-[500px]">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: 'bg-[#00E676] hover:bg-opacity-90 text-black font-bold',
                card: 'bg-[#111827] p-8 rounded-lg w-full',
                headerTitle: 'text-2xl font-bold text-white mb-6',
                headerSubtitle: 'text-gray-400',
                socialButtonsBlockButton: 'border-gray-700 text-white hover:bg-black w-full',
                formFieldLabel: 'block text-sm font-medium text-gray-300 mb-1',
                formFieldInput: 'block w-full px-4 py-3 rounded-md bg-black border border-gray-700 text-white focus:border-[#00E676] focus:ring-1 focus:ring-[#00E676] outline-none',
                footerActionLink: 'text-[#00E676] hover:underline',
                dividerLine: 'bg-gray-700',
                dividerText: 'text-gray-400',
              },
            }}
            routing="path"
            path="/sign-in"
            redirectUrl="/orders"
            afterSignInUrl="/orders"
          />
        </div>
      </div>
    </div>
  );
}