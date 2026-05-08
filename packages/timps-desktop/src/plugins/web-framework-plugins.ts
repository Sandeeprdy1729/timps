import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class ExpressPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/express',
    name: 'Express Utils',
    version: '1.0.0',
    description: 'Express utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['express', 'router', 'middleware', 'http'],
  };

  public capabilities: PluginCapabilities = {};

  createRouter(options?: RouterOptions): ExpressRouter {
    return new ExpressRouter(options);
  }

  createMiddleware(fn: MiddlewareFunction): Middleware {
    return fn;
  }

  handleError(err: Error, req: Request, res: Response, next: NextFunction): void {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }

  cors(options?: CorsOptions): Middleware {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', options?.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    };
  }

  json(options?: JsonOptions): Middleware {
    return (req, res, next) => {
      next();
    };
  }

  urlencoded(options?: UrlencodedOptions): Middleware {
    return (req, res, next) => {
      next();
    };
  }

  static(options?: StaticOptions): Middleware {
    return (req, res, next) => {
      next();
    };
  }

  validate( schema: ValidationSchema): Middleware {
    return (req, res, next) => {
      const errors = this.validateBody(req.body, schema);
      if (errors.length > 0) {
        res.status(400).json({ errors });
      } else {
        next();
      }
    };
  }

  private validateBody(body: unknown, schema: ValidationSchema): string[] {
    const errors: string[] = [];
    for (const [field, rules] of Object.entries(schema)) {
      const value = (body as Record<string, unknown>)[field];
      if (rules.required && value === undefined) {
        errors.push(`${field} is required`);
      }
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be ${rules.type}`);
      }
    }
    return errors;
  }

  rateLimit(options?: RateLimitOptions): Middleware {
    return (req, res, next) => {
      next();
    };
  }

  corsOrigin(allowedOrigins: string[]): Middleware {
    return (req, res, next) => {
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin || '*')) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
      }
      next();
    };
  }

  cacheControl(maxAge: number): Middleware {
    return (req, res, next) => {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      next();
    };
  }

  compress(options?: CompressOptions): Middleware {
    return (req, res, next) => {
      next();
    };
  }

  helmet(options?: HelmetOptions): Middleware {
    return (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    };
  }
}

export class ExpressRouter {
  private routes: Array<Route> = [];
  private params: Map<string, ParamMiddleware> = new Map();

  constructor(public options?: RouterOptions) {}

  get(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'GET', path, handlers });
    return this;
  }

  post(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'POST', path, handlers });
    return this;
  }

  put(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'PUT', path, handlers });
    return this;
  }

  delete(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'DELETE', path, handlers });
    return this;
  }

  patch(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'PATCH', path, handlers });
    return this;
  }

  options(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'OPTIONS', path, handlers });
    return this;
  }

  head(path: string, ...handlers: Handler[]): this {
    this.routes.push({ method: 'HEAD', path, handlers });
    return this;
  }

  param(name: string, handler: ParamMiddleware): this {
    this.params.set(name, handler);
    return this;
  }

  use(fn: Handler | Router): this {
    this.routes.push({ method: 'USE', path: '*', handlers: [fn as Handler] });
    return this;
  }

  all(path: string, ...handlers: Handler[]): this {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    for (const method of methods) {
      this.routes.push({ method, path, handlers });
    }
    return this;
  }

  route(path: string): Route {
    return { path, handlers: [] };
  }

  stack(): Route[] {
    return this.routes;
  }

  match(method: string, path: string): Route | null {
    for (const route of this.routes) {
      if (route.method === method && this.matchPath(route.path, path)) {
        return route;
      }
    }
    return null;
  }

  private matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) continue;
      if (patternParts[i] !== pathParts[i]) return false;
    }

    return true;
  }
}

export interface RouterOptions {
  caseSensitive?: boolean;
  mergeParams?: boolean;
  strict?: boolean;
}

export interface Handler {
  (req: Request, res: Response, next: NextFunction): void;
}

export interface Middleware {
  (req: Request, res: Response, next: NextFunction): void;
}

export type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => void;

export type NextFunction = (err?: Error) => void;

export interface Request {
  method: string;
  url: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  cookies: Record<string, string>;
  ip: string;
  ips: string[];
  hostname: string;
  protocol: string;
  secure: boolean;
  xhr: boolean;
  subdomains: string[];
  accept: () => string;
  get(name: string): string | undefined;
}

export interface Response {
  status(code: number): this;
  send(body?: unknown): this;
  json(body?: unknown): this;
  jsonp(body: unknown): this;
  links(posts: Record<string, string>): this;
  sendFile(path: string): this;
  download(path: string, filename?: string): this;
  set(headers: Record<string, string>): this;
  setHeader(name: string, value: string): this;
  getHeader(name: string): string | number | string[] | undefined;
  removeHeader(name: string): this;
  type(type: string): this;
  append(field: string, value: string): this;
  redirect(status: number, url: string): this;
  cookie(name: string, value: string, options?: CookieOptions): this;
  clearCookie(name: string, options?: CookieOptions): this;
  location(url: string): this;
  vary(field: string): this;
}

export interface Route {
  path: string;
  method?: string;
  handlers: Handler[];
}

export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface JsonOptions {
  limit?: string;
  reviver?: (key: string, value: unknown) => unknown;
}

export interface UrlencodedOptions {
  extended?: boolean;
  limit?: string;
  parameterLimit?: number;
}

export interface StaticOptions {
  root?: string;
  index?: string | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  extensions?: string[];
}

export interface ValidationSchema {
  [field: string]: {
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
  };
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: unknown;
  statusCode?: number;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface CompressOptions {
  level?: number;
  threshold?: number;
}

export interface HelmetOptions {
  contentSecurityPolicy?: boolean;
  hsts?: boolean;
}

export interface CookieOptions {
  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface ParamMiddleware {
  (req: Request, res: Response, next: NextFunction, value: string, name: string): void;
}

export class KoaPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/koa',
    name: 'Koa Utils',
    version: '1.0.0',
    description: 'Koa utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['koa', 'router', 'middleware', 'http'],
  };

  public capabilities: PluginCapabilities = {};

  createApp(options?: KoaOptions): KoaApp {
    return new KoaApp(options);
  }

  createContext(req: unknown, res: unknown): KoaContext {
    return {} as KoaContext;
  }

  compose(middlewares: KoaMiddleware[]): KoaMiddleware {
    return async (ctx, next) => {
      let i = 0;
      const dispatch = (i: number) => {
        if (i >= middlewares.length) return next();
        return middlewares[i++](ctx, () => dispatch(i));
      };
      return dispatch(0);
    };
  }
}

export class KoaApp {
  private middlewares: KoaMiddleware[] = [];
  private context: KoaContext = {};

  constructor(public options?: KoaOptions) {}

  use(fn: KoaMiddleware): this {
    this.middlewares.push(fn);
    return this;
  }

  callback(): (req: unknown, res: unknown) => void {
    return async (req, res) => {
      const ctx = this.createContext(req, res);
      const fn = this.compose(this.middlewares);
      await fn(ctx, () => {});
    };
  }

  private createContext(req: unknown, res: unknown): KoaContext {
    return this.context;
  }

  private compose(middlewares: KoaMiddleware[]): KoaMiddleware {
    return async (ctx, next) => {
      let i = 0;
      const dispatch = (i: number) => {
        if (i >= middlewares.length) return next();
        return middlewares[i++](ctx, () => dispatch(i));
      };
      return dispatch(0);
    };
  }
}

export interface KoaContext {
  req: unknown;
  res: unknown;
  request: Request;
  response: Response;
  state: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  ip: string;
  ips: string[];
  method: string;
  url: string;
  path: string;
  originalUrl: string;
  header: Record<string, string>;
  headers: Record<string, string>;
  status: number;
  message: string;
  statusCode: number;
  statusMessage: string;
  body: unknown;
}

export interface KoaOptions {
  keys?: string[];
  proxy?: boolean;
  subdomainOffset?: number;
}

export type KoaMiddleware = (ctx: KoaContext, next: () => Promise<void>) => Promise<void>;

export class WebFrameworkPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/web-framework',
    name: 'Web Framework',
    version: '1.0.0',
    description: 'Web framework utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['framework', 'web', 'http', 'server'],
  };

  public capabilities: PluginCapabilities = {};

  createServer(options?: ServerOptions): Server {
    return new Server(options);
  }

  parseRoute(path: string): RouteConfig {
    const match = path.match(/^([^:]+):([^?]+)?(?:\?(.*))?$/);
    return {
      method: match ? match[1] : 'GET',
      path: match ? match[2] : path,
      query: []
    };
  }

  matchRoute(route: RouteConfig, path: string): Record<string, boolean> {
    return { matched: true, params: {} };
  }

  parseBody(body: string, contentType: string): unknown {
    if (contentType.includes('json')) {
      return JSON.parse(body);
    }
    if (contentType.includes('urlencoded')) {
      const params: Record<string, string> = {};
      for (const pair of body.split('&')) {
        const [key, value] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
      return params;
    }
    return body;
  }

  render(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key]));
  }
}

export interface ServerOptions {
  port?: number;
  host?: string;
  backlog?: number;
}

export interface Server {
  listen(port: number, host?: string, backlog?: number): void;
  close(): void;
}

export interface RouteConfig {
  method: string;
  path: string;
  query: string[];
}

export class RestApiPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/rest-api',
    name: 'REST API',
    version: '1.0.0',
    description: 'REST API utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['rest', 'api', 'resource', 'endpoint'],
  };

  public capabilities: PluginCapabilities = {};

  createResource(name: string, options?: ResourceOptions): Resource {
    return new Resource(name, options);
  }

  createEndpoint(config: EndpointConfig): Endpoint {
    return new Endpoint(config);
  }

  parseUrl(url: string): EndpointConfig {
    const [path, query] = url.split('?');
    const params: Record<string, string> = {};

    const paramMatch = path.match(/:(\w+)/g);
    if (paramMatch) {
      for (const param of paramMatch) {
        params[param.slice(1)] = '';
      }
    }

    return {
      path,
      method: 'GET',
      params,
      query: query ? query.split('&') : []
    };
  }

  buildUrl(base: string, params?: Record<string, string>, query?: Record<string, string>): string {
    let url = base;
    for (const key in params || {}) {
      url = url.replace(`:${key}`, params[key]);
    }
    const queryString = new URLSearchParams(query).toString();
    return url + (queryString ? '?' + queryString : '');
  }

  resourceUrl(base: string, id: string): string {
    return `${base}/${id}`;
  }

  nestedResourceUrl(base: string, id: string, relation: string, relationId: string): string {
    return `${base}/${id}/${relation}/${relationId}`;
  }

  paginate(page: number, limit: number): Pagination {
    return {
      page,
      limit,
      offset: (page - 1) * limit,
      total: 0,
      totalPages: 0
    };
  }

  filter(params: Record<string, string>): Filter {
    const filters: Array<FilterCondition> = [];

    for (const [key, value] of Object.entries(params)) {
      if (value.startsWith('eq:')) {
        filters.push({ field: key, operator: 'eq', value: value.slice(3) });
      } else if (value.startsWith('ne:')) {
        filters.push({ field: key, operator: 'ne', value: value.slice(3) });
      } else if (value.startsWith('gt:')) {
        filters.push({ field: key, operator: 'gt', value: value.slice(3) });
      } else if (value.startsWith('lt:')) {
        filters.push({ field: key, operator: 'lt', value: value.slice(3) });
      } else if (value.startsWith('like:')) {
        filters.push({ field: key, operator: 'like', value: value.slice(5) });
      }
    }

    return { conditions: filters, combine: 'and' };
  }

  sort(param: string): Sort {
    const isDesc = param.startsWith('-');
    return {
      field: isDesc ? param.slice(1) : param,
      order: isDesc ? 'desc' : 'asc'
    };
  }
}

export class Resource {
  constructor(public name: string, public options?: ResourceOptions) {}

  get id(): string {
    return this.name + 'Id';
  }
}

export class Endpoint {
  constructor(public config: EndpointConfig) {}

  method = this.config.method;
  path = this.config.path;

  fullPath(): string {
    return `${this.method.toUpperCase()} ${this.path}`;
  }
}

export interface ResourceOptions {
  pluralize?: boolean;
  idType?: string;
}

export interface EndpointConfig {
  method: string;
  path: string;
  params: Record<string, string>;
  query: string[];
  handler: (req: Request) => unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
}

export interface Filter {
  conditions: FilterCondition[];
  combine: 'and' | 'or';
}

export interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

export interface Sort {
  field: string;
  order: 'asc' | 'desc';
}