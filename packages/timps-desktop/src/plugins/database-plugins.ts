import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class SqlQueryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sql-query',
    name: 'SQL Query Builder',
    version: '1.0.0',
    description: 'Build and execute SQL queries',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sql', 'query', 'database', 'builder'],
  };

  public capabilities: PluginCapabilities = {};

  select(fields: string[]): SqlQueryBuilder {
    return new SqlQueryBuilder().select(fields);
  }

  insert(table: string): SqlInsertBuilder {
    return new SqlInsertBuilder(table);
  }

  update(table: string): SqlUpdateBuilder {
    return new SqlUpdateBuilder(table);
  }

  delete(table: string): SqlDeleteBuilder {
    return new SqlDeleteBuilder(table);
  }

  createTable(name: string): SqlCreateTableBuilder {
    return new SqlCreateTableBuilder(name);
  }

  parse(sql: string): ParsedSql {
    const normalized = sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const result: ParsedSql = { type: 'unknown', clauses: {} };

    if (normalized.startsWith('select')) {
      result.type = 'select';
      result.clauses = this.parseSelectClauses(normalized);
    } else if (normalized.startsWith('insert')) {
      result.type = 'insert';
      result.clauses = this.parseInsertClauses(normalized);
    } else if (normalized.startsWith('update')) {
      result.type = 'update';
      result.clauses = this.parseUpdateClauses(normalized);
    } else if (normalized.startsWith('delete')) {
      result.type = 'delete';
      result.clauses = this.parseDeleteClauses(normalized);
    }

    return result;
  }

  private parseSelectClauses(sql: string): Record<string, string> {
    const clauses: Record<string, string> = {};

    const fromMatch = sql.match(/from\s+(\w+)/);
    if (fromMatch) clauses.from = fromMatch[1];

    const selectMatch = sql.match(/select\s+(.+?)\s+from/);
    if (selectMatch) clauses.fields = selectMatch[1];

    const whereMatch = sql.match(/where\s+(.+?)(?:\s+order|\s+group|\s+limit|$)/);
    if (whereMatch) clauses.where = whereMatch[1];

    const orderMatch = sql.match(/order\s+by\s+(.+?)(?:\s+limit|$)/);
    if (orderMatch) clauses.orderBy = orderMatch[1];

    const limitMatch = sql.match(/limit\s+(\d+)/);
    if (limitMatch) clauses.limit = limitMatch[1];

    return clauses;
  }

  private parseInsertClauses(sql: string): Record<string, string> {
    const clauses: Record<string, string> = {};

    const intoMatch = sql.match(/into\s+(\w+)/);
    if (intoMatch) clauses.table = intoMatch[1];

    const valuesMatch = sql.match(/values\s*\((.+?)\)/);
    if (valuesMatch) clauses.values = valuesMatch[1];

    return clauses;
  }

  private parseUpdateClauses(sql: string): Record<string, string> {
    const clauses: Record<string, string> = {};

    const updateMatch = sql.match(/update\s+(\w+)/);
    if (updateMatch) clauses.table = updateMatch[1];

    const setMatch = sql.match(/set\s+(.+?)(?:\s+where|$)/);
    if (setMatch) clauses.set = setMatch[1];

    const whereMatch = sql.match(/where\s+(.+?)$/);
    if (whereMatch) clauses.where = whereMatch[1];

    return clauses;
  }

  private parseDeleteClauses(sql: string): Record<string, string> {
    const clauses: Record<string, string> = {};

    const fromMatch = sql.match(/from\s+(\w+)/);
    if (fromMatch) clauses.table = fromMatch[1];

    const whereMatch = sql.match(/where\s+(.+?)$/);
    if (whereMatch) clauses.where = whereMatch[1];

    return clauses;
  }

  validate(sql: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const sqlLower = sql.toLowerCase().trim();

    if (!sqlLower.startsWith('select') &&
        !sqlLower.startsWith('insert') &&
        !sqlLower.startsWith('update') &&
        !sqlLower.startsWith('delete') &&
        !sqlLower.startsWith('create')) {
      errors.push('SQL must start with SELECT, INSERT, UPDATE, DELETE, or CREATE');
    }

    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    return { valid: errors.length === 0, errors };
  }
}

export class SqlQueryBuilder {
  private query: string = '';

  select(fields: string[]): this {
    this.query = `SELECT ${fields.join(', ')}`;
    return this;
  }

  from(table: string): this {
    this.query += ` FROM ${table}`;
    return this;
  }

  innerJoin(table: string, on: string): this {
    this.query += ` INNER JOIN ${table} ON ${on}`;
    return this;
  }

  leftJoin(table: string, on: string): this {
    this.query += ` LEFT JOIN ${table} ON ${on}`;
    return this;
  }

  rightJoin(table: string, on: string): this {
    this.query += ` RIGHT JOIN ${table} ON ${on}`;
    return this;
  }

  where(condition: string): this {
    this.query += ` WHERE ${condition}`;
    return this;
  }

  and(condition: string): this {
    this.query += ` AND ${condition}`;
    return this;
  }

  or(condition: string): this {
    this.query += ` OR ${condition}`;
    return this;
  }

  groupBy(fields: string[]): this {
    this.query += ` GROUP BY ${fields.join(', ')}`;
    return this;
  }

  having(condition: string): this {
    this.query += ` HAVING ${condition}`;
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.query += ` ORDER BY ${field} ${direction}`;
    return this;
  }

  limit(count: number, offset?: number): this {
    this.query += ` LIMIT ${offset ? offset + ', ' : ''}${count}`;
    return this;
  }

  build(): string {
    return this.query;
  }
}

export class SqlInsertBuilder {
  private query: string = '';
  private values: Record<string, unknown> = {};

  constructor(private table: string) {}

  values(record: Record<string, unknown>): this {
    this.values = record;
    return this;
  }

  build(): string {
    const fields = Object.keys(this.values).join(', ');
    const vals = Object.values(this.values).map((v) => this.quote(v)).join(', ');
    return `INSERT INTO ${this.table} (${fields}) VALUES (${vals})`;
  }

  private quote(value: unknown): string {
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (value === null) return 'NULL';
    return String(value);
  }
}

export class SqlUpdateBuilder {
  private query: string = '';
  private sets: string[] = [];

  constructor(private table: string) {}

  set(field: string, value: unknown): this {
    this.sets.push(`${field} = ${this.quote(value)}`);
    return this;
  }

  where(condition: string): this {
    this.query = `UPDATE ${this.table} SET ${this.sets.join(', ')} WHERE ${condition}`;
    return this;
  }

  build(): string {
    return this.query;
  }

  private quote(value: unknown): string {
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (value === null) return 'NULL';
    return String(value);
  }
}

export class SqlDeleteBuilder {
  private query: string = '';

  constructor(private table: string) {}

  where(condition: string): this {
    this.query = `DELETE FROM ${this.table} WHERE ${condition}`;
    return this;
  }

  build(): string {
    return this.query;
  }
}

export class SqlCreateTableBuilder {
  private query: string = '';
  private columns: string[] = [];
  private primaryKeys: string[] = [];

  constructor(private name: string) {}

  id(name = 'id'): this {
    this.columns.push(`${name} INTEGER PRIMARY KEY AUTOINCREMENT`);
    this.primaryKeys.push(name);
    return this;
  }

  integer(name: string, notNull = false): this {
    this.columns.push(`${name} INTEGER${notNull ? ' NOT NULL' : ''}`);
    return this;
  }

  text(name: string, notNull = false): this {
    this.columns.push(`${name} TEXT${notNull ? ' NOT NULL' : ''}`);
    return this;
  }

  real(name: string, notNull = false): this {
    this.columns.push(`${name} REAL${notNull ? ' NOT NULL' : ''}`);
    return this;
  }

  blob(name: string, notNull = false): this {
    this.columns.push(`${name} BLOB${notNull ? ' NOT NULL' : ''}`);
    return this;
  }

  boolean(name: string, notNull = false): this {
    this.columns.push(`${name} INTEGER${notNull ? ' NOT NULL' : ''}`);
    return this;
  }

  timestamp(name: string): this {
    this.columns.push(`${name} TEXT`);
    return this;
  }

  foreignKey(column: string, refTable: string, refColumn: string): this {
    this.columns.push(`FOREIGN KEY (${column}) REFERENCES ${refTable}(${refColumn})`);
    return this;
  }

  unique(...columns: string[]): this {
    this.columns.push(`UNIQUE (${columns.join(', ')})`);
    return this;
  }

  build(): string {
    return `CREATE TABLE ${this.name} (\n  ${this.columns.join(',\n  ')}\n)`;
  }
}

export interface ParsedSql {
  type: string;
  clauses: Record<string, string>;
}

export class MongoQueryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/mongo-query',
    name: 'MongoDB Query Builder',
    version: '1.0.0',
    description: 'Build MongoDB queries and aggregations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['mongodb', 'query', 'database', 'nosql'],
  };

  public capabilities: PluginCapabilities = {};

  find(collection: string, filter: Record<string, unknown>): MongoQuery {
    return new MongoQuery(collection).find(filter);
  }

  insert(collection: string, document: Record<string, unknown>): MongoQuery {
    return new MongoQuery(collection).insert(document);
  }

  update(collection: string, filter: Record<string, unknown>, update: Record<string, unknown>): MongoQuery {
    return new MongoQuery(collection).update(filter, update);
  }

  delete(collection: string, filter: Record<string, unknown>): MongoQuery {
    return new MongoQuery(collection).delete(filter);
  }

  aggregate(collection: string): MongoAggregation {
    return new MongoAggregation(collection);
  }

  buildFilter(criteria: FilterCriteria): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    for (const [field, condition] of Object.entries(criteria)) {
      if (typeof condition === 'object' && condition !== null) {
        const cond = condition as Record<string, unknown>;
        if (cond.op) {
          filter[field] = { [cond.op]: cond.value };
        } else {
          filter[field] = condition;
        }
      } else {
        filter[field] = condition;
      }
    }

    return filter;
  }
}

export class MongoQuery {
  private query: Record<string, unknown> = {};

  constructor(private collection: string) {}

  find(filter: Record<string, unknown>): this {
    this.query = { find: this.collection, filter };
    return this;
  }

  insert(document: Record<string, unknown>): this {
    this.query = { insert: this.collection, documents: [document] };
    return this;
  }

  update(filter: Record<string, unknown>, update: Record<string, unknown>): this {
    this.query = { update: this.collection, updates: [{ q: filter, u: update, upsert: false, multi: false }] };
    return this;
  }

  delete(filter: Record<string, unknown>): this {
    this.query = { delete: this.collection, deletes: [{ q: filter, limit: 0 }] };
    return this;
  }

  sort(field: string, direction: 1 | -1): this {
    (this.query as Record<string, unknown>).sort = { [field]: direction };
    return this;
  }

  limit(count: number): this {
    (this.query as Record<string, unknown>).limit = count;
    return this;
  }

  skip(count: number): this {
    (this.query as Record<string, unknown>).skip = count;
    return this;
  }

  project(fields: Record<string, number>): this {
    (this.query as Record<string, unknown>).project = fields;
    return this;
  }

  build(): Record<string, unknown> {
    return this.query;
  }
}

export class MongoAggregation {
  private stages: Record<string, unknown>[] = [];

  constructor(private collection: string) {}

  match(filter: Record<string, unknown>): this {
    this.stages.push({ $match: filter });
    return this;
  }

  group(groupBy: string, fields: Record<string, unknown>): this {
    const groupId = groupBy === '_id' ? groupBy : '$' + groupBy;
    this.stages.push({ $group: { _id: groupId, ...fields } });
    return this;
  }

  sort(field: string, direction: 1 | -1): this {
    this.stages.push({ $sort: { [field]: direction } });
    return this;
  }

  limit(count: number): this {
    this.stages.push({ $limit: count });
    return this;
  }

  skip(count: number): this {
    this.stages.push({ $skip: count });
    return this;
  }

  project(fields: Record<string, unknown>): this {
    this.stages.push({ $project: fields });
    return this;
  }

  lookup(from: string, localField: string, foreignField: string, as: string): this {
    this.stages.push({ $lookup: { from, localField, foreignField, as } });
    return this;
  }

  unwind(field: string): this {
    this.stages.push({ $unwind: '$' + field });
    return this;
  }

  addFields(fields: Record<string, unknown>): this {
    this.stages.push({ $addFields: fields });
    return this;
  }

  count(name: string): this {
    this.stages.push({ $count: name });
    return this;
  }

  build(): Record<string, unknown> {
    return {
      aggregate: this.collection,
      pipeline: this.stages,
      cursor: {}
    };
  }
}

export interface FilterCriteria {
  [field: string]: unknown;
}

export class RedisPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/redis',
    name: 'Redis Client',
    version: '1.0.0',
    description: 'Redis data structures and operations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['redis', 'cache', 'database', 'key-value'],
  };

  public capabilities: PluginCapabilities = {};

  string(key: string, value: string): RedisCommand {
    return new RedisCommand().set(key, value);
  }

  hash(key: string, field: string, value: string): RedisCommand {
    return new RedisCommand().hset(key, field, value);
  }

  list(key: string): RedisCommand {
    return new RedisCommand();
  }

  set(key: string, ...members: string[]): RedisCommand {
    return new RedisCommand().sadd(key, ...members);
  }

  sortedSet(key: string): RedisCommand {
    return new RedisCommand();
  }

  pubsub(channel: string): RedisCommand {
    return new RedisCommand().publish(channel, '');
  }

  get(key: string): RedisCommand {
    return new RedisCommand().get(key);
  }

  hget(key: string, field: string): RedisCommand {
    return new RedisCommand().hget(key, field);
  }

  smembers(key: string): RedisCommand {
    return new RedisCommand().smembers(key);
  }

  zrange(key: string, start: number, stop: number): RedisCommand {
    return new RedisCommand().zrange(key, start, stop);
  }

  expire(key: string, seconds: number): RedisCommand {
    return new RedisCommand().expire(key, seconds);
  }

  ttl(key: string): RedisCommand {
    return new RedisCommand().ttl(key);
  }

  del(...keys: string[]): RedisCommand {
    return new RedisCommand().del(...keys);
  }
}

export class RedisCommand {
  private commands: string[] = [];

  set(key: string, value: string): this {
    this.commands.push(`SET ${key} ${value}`);
    return this;
  }

  get(key: string): this {
    this.commands.push(`GET ${key}`);
    return this;
  }

  hset(key: string, field: string, value: string): this {
    this.commands.push(`HSET ${key} ${field} ${value}`);
    return this;
  }

  hget(key: string, field: string): this {
    this.commands.push(`HGET ${key} ${field}`);
    return this;
  }

  hmset(key: string, fields: Record<string, string>): this {
    this.commands.push(`HMSET ${key} ${Object.entries(fields).map(([k, v]) => k + ' ' + v).join(' ')}`);
    return this;
  }

  sadd(key: string, ...members: string[]): this {
    this.commands.push(`SADD ${key} ${members.join(' ')}`);
    return this;
  }

  smembers(key: string): this {
    this.commands.push(`SMEMBERS ${key}`);
    return this;
  }

  zadd(key: string, score: number, member: string): this {
    this.commands.push(`ZADD ${key} ${score} ${member}`);
    return this;
  }

  zrange(key: string, start: number, stop: number): this {
    this.commands.push(`ZRANGE ${key} ${start} ${stop}`);
    return this;
  }

  publish(channel: string, message: string): this {
    this.commands.push(`PUBLISH ${channel} ${message}`);
    return this;
  }

  expire(key: string, seconds: number): this {
    this.commands.push(`EXPIRE ${key} ${seconds}`);
    return this;
  }

  ttl(key: string): this {
    this.commands.push(`TTL ${key}`);
    return this;
  }

  del(...keys: string[]): this {
    this.commands.push(`DEL ${keys.join(' ')}`);
    return this;
  }

  build(): string {
    return this.commands.join('\n');
  }
}

export class ElasticSearchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/elasticsearch',
    name: 'ElasticSearch Client',
    version: '1.0.0',
    description: 'ElasticSearch queries and aggregations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['elasticsearch', 'search', 'elastic', 'database'],
  };

  public capabilities: PluginCapabilities = {};

  search(index: string, query: Record<string, unknown>): SearchRequest {
    return new SearchRequest(index).query(query);
  }

  index(index: string, id: string, document: Record<string, unknown>): IndexRequest {
    return new IndexRequest(index, id, document);
  }

  delete(index: string, id: string): DeleteRequest {
    return new DeleteRequest(index, id);
  }

  bulk(operations: BulkOperation[]): BulkRequest {
    return new BulkRequest(operations);
  }

  createIndex(name: string): CreateIndexRequest {
    return new CreateIndexRequest(name);
  }

  mapping(name: string, properties: Record<string, FieldMapping>): MappingRequest {
    return new MappingRequest(name, properties);
  }
}

export class SearchRequest {
  private request: Record<string, unknown> = {};

  constructor(private index: string) {}

  query(query: Record<string, unknown>): this {
    this.request.query = query;
    return this;
  }

  from(start: number): this {
    this.request.from = start;
    return this;
  }

  size(size: number): this {
    this.request.size = size;
    return this;
  }

  sort(field: string, order: 'asc' | 'desc' = 'desc'): this {
    if (!this.request.sort) this.request.sort = [];
    (this.request.sort as Record<string, unknown>[]).push({ [field]: { order } });
    return this;
  }

  aggs(name: string, agg: Record<string, unknown>): this {
    if (!this.request.aggs) this.request.aggs = {};
    (this.request.aggs as Record<string, Record<string, unknown>>)[name] = agg;
    return this;
  }

  highlight(fields: Record<string, unknown>): this {
    this.request.highlight = { fields };
    return this;
  }

  build(): Record<string, unknown> {
    return {
      index: this.index,
      body: this.request
    };
  }
}

export class IndexRequest {
  constructor(
    private index: string,
    private id: string,
    private document: Record<string, unknown>
  ) {}

  build(): Record<string, unknown> {
    return {
      index: this.index,
      id: this.id,
      body: this.document
    };
  }
}

export class DeleteRequest {
  constructor(private index: string, private id: string) {}

  build(): Record<string, unknown> {
    return { index: this.index, id: this.id };
  }
}

export interface BulkOperation {
  action: 'index' | 'delete' | 'update';
  index?: string;
  id?: string;
  document?: Record<string, unknown>;
}

export class BulkRequest {
  constructor(private operations: BulkOperation[]) {}

  build(): Record<string, unknown>[] {
    return this.operations.map((op) => {
      const action: Record<string, Record<string, unknown>> = {};
      if (op.action === 'index') {
        action.index = { _index: op.index!, _id: op.id! };
      } else if (op.action === 'delete') {
        action.delete = { _index: op.index!, _id: op.id! };
      }
      return action;
    });
  }
}

export class CreateIndexRequest {
  private settings: Record<string, unknown> = {};

  constructor(private name: string) {}

  shards(num: number): this {
    this.settings.number_of_shards = num;
    return this;
  }

  replicas(num: number): this {
    this.settings.number_of_replicas = num;
    return this;
  }

  build(): Record<string, unknown> {
    return { index: this.name, body: { settings: this.settings } };
  }
}

export interface FieldMapping {
  type: 'keyword' | 'text' | 'integer' | 'long' | 'float' | 'double' | 'boolean' | 'date';
  analyzer?: string;
}

export class MappingRequest {
  constructor(private name: string, private properties: Record<string, FieldMapping>) {}

  build(): Record<string, unknown> {
    return {
      index: this.name,
      body: { mappings: { properties: this.properties } }
    };
  }
}