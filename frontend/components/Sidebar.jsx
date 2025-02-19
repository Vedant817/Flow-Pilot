// components/Sidebar.tsx
export default function Sidebar() {
    const menuItems = [
      { icon: '📥', label: 'Inbox' },
      { icon: '🔔', label: 'Alerts', badge: 2 },
      { icon: '📊', label: 'Overview', active: true },
      { icon: '🎙️', label: 'Episodes' },
      { icon: '🖼️', label: 'Media' },
      { icon: '📁', label: 'Materials' },
      { icon: '👥', label: 'Contacts' },
    ]
  
    return (
      <div className="w-64 bg-gray-800 p-4">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-emerald-500 rounded-full" />
          <div className="ml-3">
            <h2 className="text-white">Nick Schedov</h2>
            <p className="text-gray-400 text-sm">Kuji Podcast</p>
          </div>
        </div>
        
        <nav>
          {menuItems.map((item) => (
            <div key={item.label} 
                 className={`flex items-center p-3 rounded-lg mb-2 
                            ${item.active ? 'bg-emerald-500' : 'hover:bg-gray-700'}`}>
              <span>{item.icon}</span>
              <span className="ml-3">{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-red-500 px-2 rounded-full text-sm">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>
      </div>
    )
  }
  