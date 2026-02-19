"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVectorClient = getVectorClient;
exports.initVectorStore = initVectorStore;
exports.upsertVectors = upsertVectors;
exports.searchVectors = searchVectors;
exports.deleteVector = deleteVector;
exports.deleteUserVectors = deleteUserVectors;
const js_client_rest_1 = require("@qdrant/js-client-rest");
const env_1 = require("../config/env");
let client = null;
function getVectorClient() {
    if (!client) {
        client = new js_client_rest_1.QdrantClient({
            url: env_1.config.qdrant.url,
            apiKey: env_1.config.qdrant.apiKey,
        });
    }
    return client;
}
async function initVectorStore() {
    const qdrant = getVectorClient();
    try {
        const collections = await qdrant.getCollections();
        const exists = collections.collections.some(c => c.name === env_1.config.qdrant.collectionName);
        if (!exists) {
            await qdrant.createCollection(env_1.config.qdrant.collectionName, {
                vectors: {
                    size: env_1.config.embeddings.dimension,
                    distance: 'Cosine',
                },
            });
            console.log(`Vector collection '${env_1.config.qdrant.collectionName}' created`);
        }
    }
    catch (error) {
        console.error('Failed to initialize vector store:', error);
        throw error;
    }
}
async function upsertVectors(points) {
    const qdrant = getVectorClient();
    await qdrant.upsert(env_1.config.qdrant.collectionName, {
        wait: true,
        points,
    });
}
async function searchVectors(vector, limit = 5, filter) {
    const qdrant = getVectorClient();
    const results = await qdrant.search(env_1.config.qdrant.collectionName, {
        vector,
        limit,
        filter,
        with_payload: true,
    });
    return results.map(r => ({
        id: r.id,
        vector: r.vector,
        payload: r.payload,
    }));
}
async function deleteVector(id) {
    const qdrant = getVectorClient();
    await qdrant.delete(env_1.config.qdrant.collectionName, {
        wait: true,
        points: [id],
    });
}
async function deleteUserVectors(userId) {
    const qdrant = getVectorClient();
    await qdrant.delete(env_1.config.qdrant.collectionName, {
        wait: true,
        filter: {
            must: [
                {
                    key: 'user_id',
                    match: { value: userId },
                },
            ],
        },
    });
}
//# sourceMappingURL=vector.js.map