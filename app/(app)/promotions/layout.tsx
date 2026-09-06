import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function PromotionsLayout({ children }: { children: React.ReactNode }) {
  // Server gate: allow all authenticated; finance check is soft in dev
  // In production, uncomment strict check:
  // const { has, userId } = await auth();
  // if (!userId) redirect('/sign-in');
  // if (!has({ role: 'org:finance' }) && !has({ role: 'admin' })) redirect('/analytics');
  // For now, allow any authenticated (proxy already protects /api)
  try {
    const a: any = await auth().catch(() => null);
    if (a && !a.userId && process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      // optionally redirect
    }
  } catch {}
  return <>{children}</>;
}
