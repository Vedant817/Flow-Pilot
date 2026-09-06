import mongoose, { Mongoose } from 'mongoose';
import { ensureQueryIndexes } from './db-indexes';

const MONGO_URI = process.env.MONGO_URI!;
const DATABASE_NAME = "store_db";

if (!MONGO_URI) {
    throw new Error('Please define the MONGO_URI environment variable inside .env.local');
}

interface MongooseCache {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
}

declare global {
    var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache;

if (process.env.NODE_ENV === 'development') {
    if (!global.mongooseCache) {
        global.mongooseCache = { conn: null, promise: null };
    }
    cached = global.mongooseCache;
} else {
    cached = { conn: null, promise: null };
}

async function dbConnect(): Promise<Mongoose> {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            dbName: DATABASE_NAME,
        };

        cached.promise = mongoose.connect(MONGO_URI, opts).then(async (mongooseInstance) => {
            console.log("New MongoDB connection established");

            const db = mongooseInstance.connection.db!;
            void ensureQueryIndexes(db);

            return mongooseInstance;
        }).catch(error => {
            console.error("MongoDB connection error:", error);
            cached.promise = null;
            throw error;
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

export { dbConnect };
export default dbConnect;
