import { createServer, type Server } from 'node:http';
import { URLSearchParams } from 'node:url';

interface TestResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

class TestRequest implements PromiseLike<TestResponse> {
  private readonly queryParams = new URLSearchParams();
  private readonly headers = new Headers();
  private body: unknown;
  private hasBody = false;
  private promise?: Promise<TestResponse>;

  constructor(private readonly app: unknown, private readonly method: string, private readonly path: string) {}

  query(params: Record<string, unknown> | URLSearchParams | undefined): this {
    if (!params) {
      return this;
    }

    if (params instanceof URLSearchParams) {
      for (const [key, value] of params.entries()) {
        this.queryParams.append(key, value);
      }
      return this;
    }

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }
      this.queryParams.append(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return this;
  }

  set(name: string, value: string | number | boolean): this {
    this.headers.set(name, String(value));
    return this;
  }

  send(payload: unknown): this {
    this.body = payload;
    this.hasBody = true;
    if (!this.headers.has('content-type')) {
      this.headers.set('content-type', 'application/json');
    }
    return this;
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (!this.promise) {
      this.promise = this.execute();
    }
    return this.promise.then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  catch<TResult = never>(onrejected?: (reason: unknown) => TResult | PromiseLike<TResult>): Promise<TestResponse | TResult> {
    if (!this.promise) {
      this.promise = this.execute();
    }
    return this.promise.catch(onrejected ?? undefined);
  }

  private async execute(): Promise<TestResponse> {
    const server = await this.startServer();
    try {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        throw new Error('테스트 서버 주소를 확인할 수 없습니다.');
      }

      const baseUrl = `http://127.0.0.1:${address.port}`;
      const queryString = this.queryParams.toString();
      const targetUrl = `${this.path}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(baseUrl + targetUrl, {
        method: this.method,
        headers: Object.fromEntries(this.headers.entries()),
        body: this.hasBody ? this.serializeBody(this.body) : undefined,
      });

      const raw = await response.text();
      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : undefined;
      } catch {
        // keep raw text
      }

      return {
        status: response.status,
        body: parsed,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } finally {
      server.close();
    }
  }

  private serializeBody(payload: unknown): BodyInit {
    if (typeof payload === 'string' || payload instanceof ArrayBuffer) {
      return payload as BodyInit;
    }
    if (payload instanceof URLSearchParams) {
      return payload.toString();
    }
    return JSON.stringify(payload);
  }

  private startServer(): Promise<Server> {
    return new Promise((resolve, reject) => {
      const server = createServer(this.app as Parameters<typeof createServer>[0]);
      server.once('error', reject);
      server.listen(0, () => resolve(server));
    });
  }
}

class TestClient {
  constructor(private readonly app: unknown) {}

  get(path: string): TestRequest {
    return new TestRequest(this.app, 'GET', path);
  }

  post(path: string): TestRequest {
    return new TestRequest(this.app, 'POST', path);
  }

  delete(path: string): TestRequest {
    return new TestRequest(this.app, 'DELETE', path);
  }
}

export default function supertest(app: unknown): TestClient {
  return new TestClient(app);
}

export type { TestResponse };

