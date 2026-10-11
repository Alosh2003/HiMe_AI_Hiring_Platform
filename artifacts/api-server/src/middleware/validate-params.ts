import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";

const uuidSchema = z.string().uuid();

/**
 * Validates that a route param is a well-formed UUID.
 * Prevents Postgres "invalid input syntax for type uuid" 500 errors.
 *
 * Usage: router.get("/:id", validateUuidParam("id"), handler)
 */
export function validateUuidParam(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (!value || !uuidSchema.safeParse(value).success) {
        res.status(400).json({
          error: "Invalid Request",
          message: `Invalid value for '${name}'. Expected a valid UUID.`,
        });
        return;
      }
    }
    next();
  };
}

const uuidBodySchema = z.object({
  jobId: z.string().uuid(),
});

/**
 * Validates that req.body contains a valid UUID `jobId`.
 */
export function validateJobIdBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = uuidBodySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Invalid Request",
      message: "A valid 'jobId' (UUID) is required.",
    });
    return;
  }
  next();
}