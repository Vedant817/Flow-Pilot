// app/page.tsx
'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import DashboardStats from '@/components/DashboardStats'
import AudienceGraph from '@/components/AudienceGraph'
import PopularEpisodes from '@/components/PopularEpisodes'
import WebinarCard from '@/components/WebinarCard'

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 p-6">
        <DashboardStats />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <AudienceGraph />
          <div className="space-y-6">
            <PopularEpisodes />
            <WebinarCard />
          </div>
        </div>
      </main>
    </div>
  )
}
