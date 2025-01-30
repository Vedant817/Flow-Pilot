export function DashboardView() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Total Contacts</h2>
          <p className="text-2xl font-bold">2,543</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">To Contact</h2>
          <p className="text-2xl font-bold">123</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">In Negotiation</h2>
          <p className="text-2xl font-bold">45</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Completed</h2>
          <p className="text-2xl font-bold">789</p>
        </div>
      </div>
    </div>
  )
}

