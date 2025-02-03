"use client"
import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message {
    role: "user" | "assistant"
    content: string
}

const initialMessages: Message[] = [
    {
        role: "assistant",
        content: "Hello! I'm your order management assistant. How can I help you today?",
    },
    {
        role: "user",
        content: "What was the most sold product in the last 6 months?",
    },
    {
        role: "assistant",
        content:
            "Based on our sales data for the last 6 months, the most sold product is the 'Premium Laptop'. Here's a quick summary:\n\n" +
            "- Product: Premium Laptop\n" +
            "- Total Units Sold: 1,250\n" +
            "- Revenue Generated: $1,624,875\n" +
            "- Peak Month: March 2024 with 275 units sold\n\n" +
            "This product has consistently outperformed others in our electronics category. Is there any specific information about this product or its sales trend you'd like to know?",
    },
    {
        role: "user",
        content: "Which customer has shown a decline in orders recently?",
    },
    {
        role: "assistant",
        content:
            "After analyzing recent order patterns, we've identified that customer 'Emily Brown' has shown a notable decline in orders. Here are the details:\n\n" +
            "- Customer: Emily Brown\n" +
            "- Email: emily@example.com\n" +
            "- Order Trend:\n" +
            "  * 6 months ago: 5 orders\n" +
            "  * 3 months ago: 3 orders\n" +
            "  * Last month: 1 order\n" +
            "- Total Spend:\n" +
            "  * 6 months ago: $2,500\n" +
            "  * Last month: $450\n\n" +
            "This represents a 60% decrease in order frequency and an 82% decrease in spending over the last 6 months. Would you like me to suggest some retention strategies for this customer?",
    },
]


export default function ChatbotView() {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [input, setInput] = useState("")

    const handleSend = () => {
        if (!input.trim()) return

        setMessages((prev) => [
            ...prev,
            { role: "user", content: input },
            {
                role: "assistant",
                content:
                    "I'm an AI assistant focused on order management. I can help you analyze sales data, customer trends, and inventory status. What specific information would you like to know?",
            },
        ])
        setInput("")
    }

    return (
        <div className="flex flex-col min-h-fit">
            <ScrollArea className="flex-1 overflow-y-auto p-4">
                {messages.map((message, i) => (
                    <Card
                        key={i}
                        className={`max-w-full mt-4 sm:max-w-[80%] p-4 ${message.role === "assistant" ? "ml-0 bg-muted" : "ml-auto bg-blue-500 text-primary-foreground"
                            }`}
                    >
                        {message.content}
                    </Card>
                ))}
            </ScrollArea>
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
                <Button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    )
}