import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
interface Message {
    role: "user" | "assistant"
    content: string
}

const messages: Message[] = [{ role: "assistant", content: "Hello! How can I help you today?" }]

export default function ChatbotView() {
    const [input, setInput] = useState("")

    const handleSend = () => {
        if (input.trim() === "") return

        messages.push({ role: "user", content: input })
        setInput("")
        // Simulate an API call to get a response
        setTimeout(() => {
            messages.push({ role: "assistant", content: "This is a response to your message." })
        }, 500)
    }

    return (
        <div className="flex flex-col h-screen">
            <div className="flex-1 overflow-y-auto p-4">
                {messages.map((message, i) => (
                    <Card
                        key={i}
                        className={`max-w-full sm:max-w-[80%] p-4 ${message.role === "assistant" ? "ml-0 bg-muted" : "ml-auto bg-blue-500 text-primary-foreground"
                            }`}
                    >
                        {message.content}
                    </Card>
                ))}
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                }}
                className="flex flex-col sm:flex-row gap-2 p-4"
            >
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 w-full"
                />
                <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Send
                </button>
            </form>
        </div>
    )
}