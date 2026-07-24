import { describe, expect, test, afterEach } from 'bun:test';
import { app } from './app';

describe('App Security & Middleware', () => {
  const originalSecret = process.env.ORIGIN_VERIFY_SECRET;

  afterEach(() => {
    process.env.ORIGIN_VERIFY_SECRET = originalSecret;
  });

  test('GET / healthcheck returns status ok', async () => {
    const response = await app.handle(new Request('http://localhost/'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ status: 'ok', framework: 'elysia' });
  });

  test('allows request from allowed origin', async () => {
    const response = await app.handle(
      new Request('http://localhost/', {
        headers: { origin: 'https://ehr-backend-frontend.vercel.app' },
      }),
    );
    expect(response.status).toBe(200);
  });

  test('rejects request from forbidden origin with 403', async () => {
    const response = await app.handle(
      new Request('http://localhost/documents', {
        headers: { origin: 'https://malicious-site.com' },
      }),
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Forbidden',
      message: 'Unauthorized origin',
    });
  });

  test('rejects request when ORIGIN_VERIFY_SECRET is set and header is missing/invalid', async () => {
    process.env.ORIGIN_VERIFY_SECRET = 'secret_token_123';

    const response = await app.handle(
      new Request('http://localhost/documents', {
        headers: {
          origin: 'https://ehr-backend-frontend.vercel.app',
          'x-origin-verify': 'wrong_secret',
        },
      }),
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Forbidden',
      message: 'Invalid origin verification secret',
    });
  });

  test('allows request when ORIGIN_VERIFY_SECRET matches', async () => {
    process.env.ORIGIN_VERIFY_SECRET = 'secret_token_123';

    const response = await app.handle(
      new Request('http://localhost/', {
        headers: {
          origin: 'https://ehr-backend-frontend.vercel.app',
          'x-origin-verify': 'secret_token_123',
        },
      }),
    );
    expect(response.status).toBe(200);
  });

  test('triggers rate limiter after exceeding max requests for an IP', async () => {
    const testIp = '203.0.113.42';
    const makeReq = () =>
      app.handle(
        new Request('http://localhost/', {
          headers: {
            'x-forwarded-for': testIp,
            origin: 'https://ehr-backend-frontend.vercel.app',
          },
        }),
      );

    // Send 60 allowed requests
    for (let i = 0; i < 60; i++) {
      const res = await makeReq();
      expect(res.status).toBe(200);
    }

    // 61st request should be rate-limited
    const rateLimitedRes = await makeReq();
    expect(rateLimitedRes.status).toBe(429);
  });
});
