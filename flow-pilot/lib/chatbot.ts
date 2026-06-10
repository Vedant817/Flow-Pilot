/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createHistoryAwareRetriever } from 'langchain/chains/history_aware_retriever';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { Document } from '@langchain/core/documents';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { Inventory } from '@/models/Inventory';
import { Order } from '@/models/Order';
import { Error as ErrorModel } from '@/models/Error';
import { Feedback } from '@/models/Feedback';
import dbConnect from './mongodb';

const CHATBOT_CONFIG = {
    chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'embedding-001',
    maxDocsPerCollection: Number(process.env.CHATBOT_MAX_DOCS_PER_COLLECTION || 200),
    retrieverK: Number(process.env.CHATBOT_RETRIEVER_K || 6),
    maxHistoryMessages: Number(process.env.CHATBOT_MAX_HISTORY_MESSAGES || 12),
    refreshMs: Number(process.env.CHATBOT_INDEX_REFRESH_MS || 5 * 60 * 1000),
};

type ChatHistoryMessage = { role: 'user' | 'assistant'; content: string };

type RetrievalChain = {
    invoke(input: { chat_history: (HumanMessage | AIMessage)[]; input: string }): Promise<{ answer?: string }>;
};

let retrievalChain: RetrievalChain | null = null;
let initializedAt = 0;
let initializationPromise: Promise<void> | null = null;

function requireGeminiApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured. The chatbot cannot initialize without a server-side Gemini key.');
    }
    return apiKey;
}

function truncate(value: unknown, maxLength = 700): string {
    if (value === null || value === undefined) return 'unknown';
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function redactEmail(value: unknown): string {
    const email = typeof value === 'string' ? value.trim() : '';
    if (!email || !email.includes('@')) return 'redacted';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
}

function buildInventoryDocument(item: any): Document {
    return new Document({
        pageContent: [
            `Source: inventory`,
            `Inventory ID: ${item._id?.toString() ?? 'unknown'}`,
            `Product: ${truncate(item.name, 180)}`,
            `Category: ${truncate(item.category, 120)}`,
            `Available quantity: ${Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 'unknown'}`,
            `Current price: ${Number.isFinite(Number(item.price)) ? Number(item.price) : 'unknown'}`,
            `Low-stock alert level: ${Number.isFinite(Number(item.stock_alert_level)) ? Number(item.stock_alert_level) : 'unknown'}`,
            `Warehouse location: ${truncate(item.warehouse_location, 160)}`,
        ].join('\n'),
        metadata: { source: 'inventory', recordId: item._id?.toString() },
    });
}

function buildOrderDocument(order: any): Document {
    const products = Array.isArray(order.products)
        ? order.products.map((product: any) => `${truncate(product.name, 120)} x ${Number(product.quantity) || 0}`).join(', ')
        : 'unknown';

    return new Document({
        pageContent: [
            `Source: order`,
            `Order ID: ${order._id?.toString() ?? 'unknown'}`,
            `Customer email: ${redactEmail(order.email)}`,
            `Status: ${truncate(order.status, 80)}`,
            `Delivery date: ${truncate(order.date, 40)}`,
            `Delivery time: ${truncate(order.time, 40)}`,
            `Products: ${products}`,
        ].join('\n'),
        metadata: { source: 'order', recordId: order._id?.toString() },
    });
}

function buildErrorDocument(error: any): Document {
    return new Document({
        pageContent: [
            `Source: error`,
            `Error ID: ${error._id?.toString() ?? 'unknown'}`,
            `Type: ${truncate(error.type, 80)}`,
            `Severity: ${truncate(error.severity, 80)}`,
            `Timestamp: ${truncate(error.timestamp, 80)}`,
            `Message: ${truncate(error.errorMessage, 700)}`,
        ].join('\n'),
        metadata: { source: 'error', recordId: error._id?.toString() },
    });
}

function buildFeedbackDocument(feedback: any): Document {
    return new Document({
        pageContent: [
            `Source: customer_feedback`,
            `Feedback ID: ${feedback._id?.toString() ?? 'unknown'}`,
            `Customer email: ${redactEmail(feedback.email)}`,
            `Sentiment: ${truncate(feedback.type, 80)}`,
            `Created at: ${truncate(feedback.createdAt, 80)}`,
            `Review: ${truncate(feedback.review, 700)}`,
        ].join('\n'),
        metadata: { source: 'customer_feedback', recordId: feedback._id?.toString() },
    });
}

async function loadKnowledgeDocuments(): Promise<Document[]> {
    await dbConnect();

    const loader = new DirectoryLoader('attachments', {
        '.txt': (path: string) => new TextLoader(path),
        '.md': (path: string) => new TextLoader(path),
    });

    const [attachmentDocs, inventoryItems, orderItems, errorItems, feedbackItems] = await Promise.all([
        loader.load().catch((error: unknown) => {
            console.warn(`No chatbot attachments loaded; continuing with database context. ${error}`);
            return [] as Document[];
        }),
        Inventory.find({}).sort({ _id: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
        Order.find({}).sort({ _id: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
        ErrorModel.find({}).sort({ timestamp: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
        Feedback.find({}).sort({ createdAt: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
    ]);

    const mongoDocs = [
        ...inventoryItems.map(buildInventoryDocument),
        ...orderItems.map(buildOrderDocument),
        ...errorItems.map(buildErrorDocument),
        ...feedbackItems.map(buildFeedbackDocument),
    ];

    return [...attachmentDocs, ...mongoDocs];
}

async function rebuildChain() {
    console.log('Initializing chatbot chain with configured Gemini models...');

    const apiKey = requireGeminiApiKey();
    const llm = new ChatGoogleGenerativeAI({
        apiKey,
        model: CHATBOT_CONFIG.chatModel,
        temperature: 0.2,
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: CHATBOT_CONFIG.embeddingModel,
    });

    const allDocs = await loadKnowledgeDocuments();

    if (allDocs.length === 0) {
        console.warn('No documents found to create a vector store. The chatbot will have no knowledge base.');
        retrievalChain = null;
        initializedAt = Date.now();
        return;
    }

    const vectorstore = await MemoryVectorStore.fromDocuments(allDocs, embeddings);
    const retriever = vectorstore.asRetriever(CHATBOT_CONFIG.retrieverK);

    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
        [
            'system',
            'Given chat history and the latest question, rewrite the question as a standalone operations question. Do not answer it.',
        ],
        new MessagesPlaceholder('chat_history'),
        ['user', '{input}'],
    ]);

    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
        llm: llm as any,
        retriever,
        rephrasePrompt: historyAwarePrompt as any,
    });

    const responsePrompt = ChatPromptTemplate.fromMessages([
        [
            'system',
            [
                'You are Flow Pilot, an operations copilot for a commerce business.',
                'Answer only from the supplied context. If context is insufficient, say what is missing instead of guessing.',
                'Do not reveal full phone numbers, full email addresses, secrets, API keys, or unrelated customer PII.',
                'Separate factual observations from recommendations.',
                'When giving operational recommendations, mention assumptions and risk/approval needs.',
                'Context:\n{context}',
            ].join('\n'),
        ],
        new MessagesPlaceholder('chat_history'),
        ['user', '{input}'],
    ]);

    const stuffDocumentsChain = await createStuffDocumentsChain({
        llm: llm as any,
        prompt: responsePrompt as any,
    });

    retrievalChain = await createRetrievalChain({
        retriever: historyAwareRetrieverChain,
        combineDocsChain: stuffDocumentsChain,
    }) as RetrievalChain;

    initializedAt = Date.now();
    console.log(`Chatbot chain initialized with ${allDocs.length} redacted documents.`);
}

async function initializeChain() {
    const isFresh = retrievalChain && Date.now() - initializedAt < CHATBOT_CONFIG.refreshMs;
    if (isFresh) return;

    if (!initializationPromise) {
        initializationPromise = rebuildChain().finally(() => {
            initializationPromise = null;
        });
    }

    await initializationPromise;
}

export async function getChatbotResponse(input: string, chatHistory: ChatHistoryMessage[]) {
    try {
        await initializeChain();
    } catch (error) {
        console.error('Failed to initialize chatbot chain:', error);
        return 'Sorry, the AI assistant is not configured correctly. Please verify the server model configuration and try again later.';
    }

    if (!retrievalChain) {
        return 'Sorry, my knowledge base is currently unavailable. Please try again later.';
    }

    const formattedHistory = chatHistory
        .slice(-CHATBOT_CONFIG.maxHistoryMessages)
        .map(msg => msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content));

    try {
        const response = await retrievalChain.invoke({
            chat_history: formattedHistory,
            input: truncate(input, 2000),
        });
        return response.answer || "I'm sorry, I couldn't process that.";
    } catch (error) {
        console.error('Error in LangChain invocation:', error);
        return "Sorry, I'm having trouble connecting to my brain right now. Please try again later.";
    }
}
