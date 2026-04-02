export { pool, initDatabase, query, queryOne, execute } from './postgres';
export { 
  getVectorClient, 
  initVectorStore, 
  upsertVectors, 
  searchVectors, 
  deleteVector, 
  deleteUserVectors,
  VectorPoint 
} from './vector';
export { initGateWeaveTables } from './gateWeaveDb';
