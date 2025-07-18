'use client'
import { SignIn } from '@clerk/nextjs';
import { SendToBack } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 w-screen">
      <div className="flex min-h-screen w-full">
        <div className="w-full hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full filter blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-indigo-400 to-blue-500 rounded-full filter blur-3xl"></div>
          </div>
          
          <div className="z-10 text-center w-1/2">
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                <SendToBack size={28} />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Omni Order</h1>
            <p className="text-xl text-slate-600">Welcome back</p>
          </div>
        </div>
        
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white/30 backdrop-blur-sm lg:border-l border-slate-200/50">
          <div className="w-full max-w-md">

            <SignIn 
              appearance={{
                elements: {
                  formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all',
                  card: 'bg-white/80 backdrop-blur-md p-8 rounded-2xl border border-slate-200/50 shadow-2xl w-full',
                  headerTitle: 'text-2xl font-bold text-slate-900 mb-2',
                  headerSubtitle: 'text-slate-600',
                  socialButtonsBlockButton: 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-lg border-2 hover:border-slate-400 transition-all w-full',
                  formFieldLabel: 'block text-sm font-semibold text-slate-700 mb-2',
                  formFieldInput: 'block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-slate-400',
                  footerActionLink: 'text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors',
                  dividerLine: 'bg-slate-200',
                  dividerText: 'text-slate-500 bg-white px-4',
                  formFieldSuccessText: 'text-green-600',
                  formFieldErrorText: 'text-red-600',
                  identityPreviewText: 'text-slate-600',
                  identityPreviewEditButton: 'text-blue-600 hover:text-blue-700',
                  formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-700',
                },
                layout: {
                  socialButtonsVariant: 'blockButton',
                }
              }}
              routing="path"
              path="/sign-in"
              redirectUrl="/orders"
              afterSignInUrl="/orders"
            />
          </div>
        </div>
      </div>
    </div>
  );
}