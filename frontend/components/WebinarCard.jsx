// components/WebinarCard.tsx
export default function WebinarCard() {
    return (
      <div className="bg-emerald-500 p-6 rounded-xl relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <button className="text-white/80 hover:text-white">
            <span className="sr-only">Options</span>
            ⋮
          </button>
        </div>
  
        <div className="mb-8">
          <span className="text-emerald-100 text-sm">Webinars</span>
          <h3 className="text-xl font-bold mt-1">
            Learn how you can earn more then 20% each month!
          </h3>
        </div>
  
        <p className="text-emerald-100 mb-6">
          Join our webinar and learn how to increase more then 20% your monthly income
        </p>
  
        <button className="bg-white text-emerald-500 px-4 py-2 rounded-lg font-medium">
          Learn more
        </button>
      </div>
    )
  }
  