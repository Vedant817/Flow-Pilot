// components/AISidebar.tsx
'use client'

import { useState } from 'react'

interface Message {
  text: string;
  type: 'user' | 'bot';
}

export default function AISidebar() {
  const [messages, setMessages] = useState<Message[]>([
    { text: 'Hello! How can I assist you today? 😊', type: 'bot' }
  ])
  const [inputMessage, setInputMessage] = useState('')

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      // Add user message
      setMessages([...messages, { text: inputMessage, type: 'user' }])
      setInputMessage('')
      
      // Simulate bot response
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          text: "Thanks for your message! I'm processing your request.", 
          type: 'bot' 
        }])
      }, 1000)
    }
  }

  return (
    <div className="w-full bg-[#141414] h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#1A1A1A]">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[#00E676] rounded-full flex items-center justify-center">
            🤖
          </div>
          <div className="ml-3">
            <h2 className="text-white font-medium">AI Assistant</h2>
            <p className="text-gray-400 text-sm">Online</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      

{/* Chat Area */}
<div className="flex-1 p-4 overflow-y-auto text-white">
  <div className="space-y-4">
    {messages.map((message, index) => (
      <div key={index} 
           className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`p-3 rounded-lg inline-block ${
          message.type === 'user' 
            ? 'bg-[#00E676] text-black' 
            : 'bg-[#1A1A1A] text-white'
        }`}>
          <p className="whitespace-pre-wrap break-words max-w-[280px]">
            {message.text}
          </p>
        </div>
      </div>
    ))}
  </div>
</div>


      {/* Chat Input */}
      <div className="p-4 border-t border-[#2A2A2A] w-full">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="w-full bg-[#1A1A1A] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#00E676]"
          />
          <button 
            onClick={handleSendMessage}
            className="bg-[#00E676] text-black px-4 py-2 rounded-lg hover:bg-[#00ff84] transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
