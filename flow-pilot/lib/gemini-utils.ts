/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set in the environment variables');
}
const genAI = new GoogleGenerativeAI(apiKey);

interface ProductDetail {
  name: string;
  quantity: number;
}

interface OrderDetails {
  name: string;
  phone: string;
  products: ProductDetail[];
  date: string;
  time: string;
}

interface FeedbackDetails {
  review: string;
  type: 'good' | 'bad' | 'neutral';
}

const classificationModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are an email classification expert. Your only task is to categorize emails.',
});

const jsonExtractionModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: "You are an expert at extracting structured data from text. You will receive an email and must output a valid JSON object based on the user's request. Do not include any other text or markdown formatting.",
  generationConfig: {
    responseMimeType: 'application/json',
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ],
});

export async function classifyEmail(emailBody: string): Promise<'new_order' | 'update_order' | 'feedback' | 'other'> {
  const prompt = `
    Classify the following email content into one of these categories: "new_order", "update_order", "feedback", "other".
    Respond with ONLY the category name and nothing else.

    Email:
    ${emailBody}
  `;

  try {
    const result = await classificationModel.generateContent(prompt);
    const classification = result.response.text().trim().toLowerCase() as any;

    if (['new_order', 'update_order', 'feedback', 'other'].includes(classification)) {
      return classification;
    }
    console.warn(`Unexpected classification result: "${classification}"`);
    return 'other';
  } catch (error) {
    console.error('Error classifying email:', error);
    return 'other';
  }
}

export async function extractOrderDetails(emailBody: string): Promise<OrderDetails | null> {
  const prompt = `
    Extract the order details from the following email content.
    The customer's full name should be in the "name" field.
    The customer's phone number should be in the "phone" field.
    The products should be in the "products" array.
    The delivery date should be in "YYYY-MM-DD" format.
    The delivery time should be in "HH:MM" format.

    JSON Schema to follow:
    { "name": "", "phone": "", "products": [{ "name": "", "quantity": 0 }], "date": "", "time": "" }

    Email:
    ${emailBody}
  `;

  try {
    const result = await jsonExtractionModel.generateContent(prompt);
    const jsonText = result.response.text();
    return JSON.parse(jsonText) as OrderDetails;
  } catch (error) {
    console.error('Error extracting order details:', error);
    return null;
  }
}

export async function extractFeedbackDetails(emailBody: string): Promise<FeedbackDetails | null> {
  const prompt = `
    Extract the feedback from the following email content.
    The customer's full review should be in the "review" field.
    The sentiment of the feedback ("good", "bad", or "neutral") should be in the "type" field.

    JSON Schema to follow:
    { "review": "", "type": "" }

    Email:
    ${emailBody}
  `;

  try {
    const result = await jsonExtractionModel.generateContent(prompt);
    const jsonText = result.response.text();
    return JSON.parse(jsonText) as FeedbackDetails;
  } catch (error) {
    console.error('Error extracting feedback details:', error);
    return null;
  }
}