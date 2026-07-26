import { describe, expect, test, afterEach } from 'bun:test';
import { app } from './app';
import { validateEnv } from 'shared';

describe('App Security & Middleware', () => {
  const originalSecret = process.env.ORIGIN_VERIFY_SECRET;
  const originalApiKey = process.env.API_KEY;

  afterEach(() => {
    process.env.ORIGIN_VERIFY_SECRET = originalSecret;
    process.env.API_KEY = originalApiKey;
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

  test('rejects request with 401 when API key is missing or invalid on protected route', async () => {
    process.env.API_KEY = 'test_api_key_123';

    const response = await app.handle(
      new Request('http://localhost/documents', {
        headers: {
          origin: 'https://ehr-backend-frontend.vercel.app',
          'x-api-key': 'wrong_key',
        },
      }),
    );
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Unauthorized',
      message: 'Invalid or missing API Key',
    });
  });

  test('triggers rate limiter based on right-most IP in X-Forwarded-For', async () => {
    const targetIp = '203.0.113.99';
    const makeReq = (spoofedPrefix: string) =>
      app.handle(
        new Request('http://localhost/', {
          headers: {
            'x-forwarded-for': `${spoofedPrefix}, ${targetIp}`,
            origin: 'https://ehr-backend-frontend.vercel.app',
          },
        }),
      );

    // Send 60 requests with varying spoofed prefixes but same right-most IP
    for (let i = 0; i < 60; i++) {
      const res = await makeReq(`1.2.3.${i}`);
      expect(res.status).toBe(200);
    }

    // 61st request should be rate limited because right-most IP matches
    const rateLimitedRes = await makeReq('9.9.9.9');
    expect(rateLimitedRes.status).toBe(429);
  });
});

describe('Boot-Time Environment Variable Validation (TypeBox)', () => {
  test('validates valid environment configuration successfully', () => {
    const result = validateEnv({
      NODE_ENV: 'development',
      PORT: '3000',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('catches invalid NODE_ENV deployment mode and throws error', () => {
    const result = validateEnv(
      {
        NODE_ENV: 'staging',
      },
      { throwOnError: false },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('NODE_ENV'))).toBe(true);

    expect(() => {
      validateEnv({
        NODE_ENV: 'staging',
      });
    }).toThrow('Boot-Time Config Validation Failed');
  });

  test('catches invalid data type format via TypeBox schema', () => {
    const result = validateEnv(
      {
        NODE_ENV: 'development',
        PORT: 'invalid_port_string',
      },
      { throwOnError: false },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('throws error in production when mandatory variables (including API_KEY) are missing', () => {
    expect(() => {
      validateEnv({
        NODE_ENV: 'production',
        DOCUMENTS_BUCKET_NAME: 'test-bucket',
        EHR_TABLE_NAME: 'test-table',
        // missing API_KEY
      });
    }).toThrow('Boot-Time Config Validation Failed');
  });

  test('passes validation in production when all required variables are set', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      DOCUMENTS_BUCKET_NAME: 'test-bucket',
      EHR_TABLE_NAME: 'test-table',
      API_KEY: 'secret-key-123456789',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
