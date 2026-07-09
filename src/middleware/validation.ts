import { z } from 'zod';
import type { MiddlewareHandler } from 'hono';

export const validateParam = (
  paramName: string,
  schema: z.ZodSchema,
): MiddlewareHandler => {
  return async (c, next) => {
    const value = c.req.param(paramName);
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          error: 'Bad Request',
          message: `Invalid parameter: ${paramName}`,
          details: result.error.errors.map((err) => err.message),
        },
        400,
      );
    }
    await next();
  };
};

export const validateQuery = (
  paramName: string,
  schema: z.ZodSchema,
): MiddlewareHandler => {
  return async (c, next) => {
    const value = c.req.query(paramName);
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          error: 'Bad Request',
          message: `Invalid query parameter: ${paramName}`,
          details: result.error.errors.map((err) => err.message),
        },
        400,
      );
    }
    await next();
  };
};
