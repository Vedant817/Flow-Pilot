import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader } from "lucide-react";

export function FeedbackSection ()  {
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/feedback-report")
      .then((response) => response.json())
      .then((data) => {
        const extractedFeedback = extractFeedback(data.feedback_report);
        setFeedbackData(extractedFeedback);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching feedback:", error);
        setLoading(false);
      });
  }, []);

  const extractFeedback = (report:any) => {
    const regex = /\| ([^|]+) \| ([^|]+) \| ([^|]+) \|/g;
    let matches;
    const feedbackList = [];

    while ((matches = regex.exec(report)) !== null) {
      if (matches[1].trim() !== "Customer Name") {
        feedbackList.push({
          name: matches[1].trim(),
          feedback: matches[2].trim(),
          sentiment: matches[3].trim(),
        });
      }
    }
    return feedbackList;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Customer Feedback</h1>
      {loading ? (
        <div className="flex justify-center">
          <Loader className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feedbackData.map((feedback, index) => (
            <Card key={index} className="p-4 shadow-md">
              <CardContent className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>
                    {feedback.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold">{feedback.name}</h2>
                  <p className="text-gray-600">{feedback.feedback}</p>
                  <span
                    className={`inline-block px-2 py-1 text-sm mt-2 rounded ${
                      feedback.sentiment.includes("Positive")
                        ? "bg-green-100 text-green-800"
                        : feedback.sentiment.includes("Negative")
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {feedback.sentiment}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

