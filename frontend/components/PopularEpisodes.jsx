// components/PopularEpisodes.tsx
export default function PopularEpisodes() {
    const episodes = [
      {
        id: 1,
        title: 'Kuji Podcast 33: Live',
        guest: 'Guest: Nurlan Saburov',
        views: '1,99m',
        status: 'Live'
      },
      {
        id: 2,
        title: 'Kuji Podcast 20: Live',
        guest: 'Guest: Nurlan Saburov',
        views: '1,54m',
        status: 'Live'
      },
      {
        id: 3,
        title: 'Kuji Podcast 24: Live',
        guest: 'Guest: Nurlan Saburov',
        views: '1,04m',
        status: 'Live'
      }
    ]
  
    return (
      <div className="bg-gray-800/50 p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Popular episodes</h3>
          <button className="text-emerald-500 text-sm">See all</button>
        </div>
        
        <div className="space-y-4">
          {episodes.map((episode) => (
            <div key={episode.id} className="flex items-center gap-4">
              <span className="bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center">
                {episode.id}
              </span>
              <div className="flex-1">
                <h4 className="font-medium">{episode.title}</h4>
                <p className="text-gray-400 text-sm">{episode.guest}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{episode.views}</p>
                <span className="text-emerald-500 text-sm">{episode.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  