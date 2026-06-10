/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { Inventory } from '@/models/Inventory';
import { Order } from '@/models/Order';
import { Error as ErrorModel } from '@/models/Error';
import { Feedback } from '@/models/Feedback';
import dbConnect from './mongodb';
import { generateText, getModelRuntimeSummary } from '@/lib/ai/model-gateway';

const CHATBOT_CONFIG = {
    maxDocsPerCollection: Number(process.env.CHATBOT_MAX_DOCS_PER_COLLECTION || 200),
    retrieverK: Number(process.env.CHATBOT_RETRIEVER_K || 8),
    maxHistoryMessages: Number(process.env.CHATBOT_MAX_HISTORY_MESSAGES || 12),
    refreshMs: Number(process.env.CHATBOT_INDEX_REFRESH_MS || 5 * 60 * 1000),
    maxContextChars: Number(process.env.CHATBOT_MAX_CONTEXT_CHARS || 12000),
};

type ChatHistoryMessage = { role: 'user' | 'assistant'; content: string };

type KnowledgeDocument = {
    pageContent: string;
    metadata: {
        source: string;
        recordId?: string;
    };
};

let knowledgeDocuments: KnowledgeDocument[] = [];
let initializedAt = 0;
let initializationPromise: Promise<void> | null = null;

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

function tokenize(value: string): Set<string> {
    return new Set(
        value
            .toLowerCase()
            .replace(/[^a-z0-9\s_-]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length >= 2)
    );
}

function scoreDocument(queryTokens: Set<string>, doc: KnowledgeDocument): number {
    const docTokens = tokenize(doc.pageContent);
    let score = 0;

    for (const token of queryTokens) {
        if (docTokens.has(token)) score += 2;
        if (doc.metadata.recordId?.toLowerCase().includes(token)) score += 3;
        if (doc.metadata.source.toLowerCase().includes(token)) score += 1;
    }

    return score;
}

function retrieveRelevantDocs(query: string, docs: KnowledgeDocument[]) {
    const queryTokens = tokenize(query);
    if (queryTokens.size === 0) return docs.slice(0, CHATBOT_CONFIG.retrieverK);

    return docs
        .map(doc => ({ doc, score: scoreDocument(queryTokens, doc) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, CHATBOT_CONFIG.retrieverK)
        .map(item => item.doc);
}

function buildInventoryDocument(item: any): KnowledgeDocument {
    return {
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
    };
}

function buildOrderDocument(order: any): KnowledgeDocument {
    const products = Array.isArray(order.products)
        ? order.products.map((product: any) => `${truncate(product.name, 120)} x ${Number(product.quantity) || 0}`).join(', ')
        : 'unknown';

    return {
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
    };
}

function buildErrorDocument(error: any): KnowledgeDocument {
    return {
        pageContent: [
            `Source: error`,
            `Error ID: ${error._id?.toString() ?? 'unknown'}`,
            `Type: ${truncate(error.type, 80)}`,
            `Severity: ${truncate(error.severity, 80)}`,
            `Timestamp: ${truncate(error.timestamp, 80)}`,
            `Message: ${truncate(error.errorMessage, 700)}`,
        ].join('\n'),
        metadata: { source: 'error', recordId: error._id?.toString() },
    };
}

function buildFeedbackDocument(feedback: any): KnowledgeDocument {
    return {
        pageContent: [
            `Source: customer_feedback`,
            `Feedback ID: ${feedback._id?.toString() ?? 'unknown'}`,
            `Customer email: ${redactEmail(feedback.email)}`,
            `Sentiment: ${truncate(feedback.type, 80)}`,
            `Created at: ${truncate(feedback.createdAt, 80)}`,
            `Review: ${truncate(feedback.review, 700)}`,
        ].join('\n'),
        metadata: { source: 'customer_feedback', recordId: feedback._id?.toString() },
    };
}

async function loadAttachmentDocuments(): Promise<KnowledgeDocument[]> {
    const attachmentsDir = path.join(process.cwd(), 'attachments');

    try {
        const files = await readdir(attachmentsDir, { withFileTypes: true });
        const textFiles = files
            .filter((file: any) => file.isFile() && /\.(txt|md)$/i.test(file.name))
            .slice(0, CHATBOT_CONFIG.maxDocsPerCollection);

        const docs = await Promise.all(textFiles.map(async (file: any) => {
            const content = await readFile(path.join(attachmentsDir, file.name), 'utf-8');
            return {
                pageContent: `Source: attachment\nFilename: ${file.name}\nContent: ${truncate(content, 3000)}`,
                metadata: { source: 'attachment', recordId: file.name },
            };
        }));

        return docs;
    } catch (error) {
        console.warn(`No chatbot attachments loaded; continuing with database context. ${error}`);
        return [];
    }
}

async function loadKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    await dbConnect();

    const [attachmentDocs, inventoryItems, orderItems, errorItems, feedbackItems] = await Promise.all([
        loadAttachmentDocuments(),
        Inventory.find({}).sort({ _id: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
        Order.find({}).sort({ _id: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
        ErrorModel.find({}).sort({ timestamp: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
        Feedback.find({}).sort({ createdAt: -1 }).limit(CHATBOT_CONFIG.maxDocsPerCollection).lean(),
    ]);

    return [
        ...attachmentDocs,
        ...inventoryItems.map(buildInventoryDocument),
        ...orderItems.map(buildOrderDocument),
        ...errorItems.map(buildErrorDocument),
        ...feedbackItems.map(buildFeedbackDocument),
    ];
}

async function rebuildKnowledgeIndex() {
    const runtime = getModelRuntimeSummary();
    console.log(`Initializing chatbot knowledge index for ${runtime.provider} model ${runtime.chatModel}...`);
    knowledgeDocuments = await loadKnowledgeDocuments();
    initializedAt = Date.now();
    console.log(`Chatbot knowledge index initialized with ${knowledgeDocuments.length} redacted documents.`);
}

async function initializeKnowledgeIndex() {
    const isFresh = knowledgeDocuments.length > 0 && Date.now() - initializedAt < CHATBOT_CONFIG.refreshMs;
    if (isFresh) return;

    if (!initializationPromise) {
        initializationPromise = rebuildKnowledgeIndex().finally(() => {
            initializationPromise = null;
        });
    }

    await initializationPromise;
}

function formatHistory(chatHistory: ChatHistoryMessage[]): string {
    return chatHistory
        .slice(-CHATBOT_CONFIG.maxHistoryMessages)
        .map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${truncate(message.content, 800)}`)
        .join('\n');
}

function formatContext(docs: KnowledgeDocument[]): string {
    return docs
        .map((doc, index) => `[${index + 1}] ${doc.pageContent}`)
        .join('\n\n')
        .slice(0, CHATBOT_CONFIG.maxContextChars);
}

export async function getChatbotResponse(input: string, chatHistory: ChatHistoryMessage[]) {
    try {
        await initializeKnowledgeIndex();
    } catch (error) {
        console.error('Failed to initialize chatbot knowledge index:', error);
        return 'Sorry, the AI assistant knowledge index is not available. Please verify the server database and model configuration.';
    }

    if (knowledgeDocuments.length === 0) {
        return 'Sorry, my knowledge base is currently unavailable. Please try again later.';
    }

    const safeInput = truncate(input, 2000);
    const relevantDocs = retrieveRelevantDocs(safeInput, knowledgeDocuments);
    const context = formatContext(relevantDocs);

    if (!context) {
        return "I don't have enough relevant operational context to answer that. Please provide an order ID, product name, or narrower question.";
    }

    const system = [
        'You are Flow Pilot, an operations copilot for a commerce business.',
        'Use only the provided context and chat history.',
        'If context is insufficient, say what is missing instead of guessing.',
        'Do not reveal full phone numbers, full email addresses, secrets, API keys, or unrelated customer PII.',
        'Separate factual observations from recommendations.',
        'When giving operational recommendations, mention assumptions and risk/approval needs.',
    ].join('\n');

    const prompt = `
Chat history:
${formatHistory(chatHistory) || 'No prior chat history.'}

Operational context:
${context}

User question:
${safeInput}
`;

    try {
        return await generateText({
            task: 'chatbot_answer',
            system,
            prompt,
            temperature: 0.2,
        });
    } catch (error) {
        console.error('Error in chatbot model invocation:', error);
        return "Sorry, I'm having trouble connecting to the configured local model right now. Please verify the model server and try again later.";
    }
}
