'use client'
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar"));

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex h-screen overflow-hidden bg-black w-full">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}