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

let retrievalChain: any;
let isInitialized = false;

async function initializeChain() {
    if (isInitialized) {
        return;
    }

    console.log('Initializing chatbot chain with Gemini...');

    const llm = new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash',
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        model: "embedding-001",
    });

    await dbConnect();
    const loader = new DirectoryLoader('attachments', {
        '.txt': (path) => new TextLoader(path),
        '.md': (path) => new TextLoader(path),
    });

    const [attachmentDocs, inventoryItems, orderItems, errorItems, feedbackItems] = await Promise.all([
        loader.load().catch(e => { console.error(`No attachments found, continuing without them. ${e}`); return []; }),
        Inventory.find({}),
        Order.find({}),
        ErrorModel.find({}),
        Feedback.find({}),
    ]);

    const mongoDocs = [
        ...inventoryItems.map(item => new Document({ pageContent: `Inventory Item: ${JSON.stringify(item)}` })),
        ...orderItems.map(item => new Document({ pageContent: `Order: ${JSON.stringify(item)}` })),
        ...errorItems.map(item => new Document({ pageContent: `Error Log: ${JSON.stringify(item)}` })),
        ...feedbackItems.map(item => new Document({ pageContent: `Customer Feedback: ${JSON.stringify(item)}` })),
    ];

    const allDocs = [...attachmentDocs, ...mongoDocs];

    if (allDocs.length === 0) {
        console.warn('No documents found to create a vector store. The chatbot will have no knowledge base.');
        isInitialized = true;
        return;
    }

    const vectorstore = await MemoryVectorStore.fromDocuments(allDocs, embeddings);
    const retriever = vectorstore.asRetriever();

    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
        ["system", "Given a chat history and the latest user question which might reference context in the chat history, formulate a standalone question that can be understood without the chat history. Do NOT answer the question, just reformulate it if needed and otherwise return it as is."],
        new MessagesPlaceholder("chat_history"),
        ["user", "{input}"],
    ]);

    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
        llm: llm as any,
        retriever,
        rephrasePrompt: historyAwarePrompt as any,
    });

    const historyAwareResponsePrompt = ChatPromptTemplate.fromMessages([
        ["system", "You are an expert AI assistant for an e-commerce business. Answer the user's questions based on the context provided below.\n\n{context}\n\nIf the information is not in the context, say that you don't have access to that information."],
        new MessagesPlaceholder("chat_history"),
        ["user", "{input}"],
    ]);

    const stuffDocumentsChain = await createStuffDocumentsChain({
        llm: llm as any,
        prompt: historyAwareResponsePrompt as any,
    });

    retrievalChain = await createRetrievalChain({
        retriever: historyAwareRetrieverChain,
        combineDocsChain: stuffDocumentsChain,
    });

    isInitialized = true;
    console.log('Chatbot chain initialized successfully with Gemini.');
}

export async function getChatbotResponse(input: string, chatHistory: { role: 'user' | 'assistant'; content: string }[]) {
    await initializeChain();

    if (!retrievalChain) {
        return "Sorry, my knowledge base is currently unavailable. Please try again later.";
    }

    const formattedHistory = chatHistory.map(msg =>
        msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    try {
        const response = await retrievalChain.invoke({
            chat_history: formattedHistory,
            input,
        });
        return response.answer || "I'm sorry, I couldn't process that.";
    } catch (error) {
        console.error("Error in LangChain invocation:", error);
        return "Sorry, I'm having trouble connecting to my brain right now. Please try again later.";
    }
}
