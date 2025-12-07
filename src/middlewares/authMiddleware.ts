import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../controllers/authController";

// Define a custom interface for the JWT payload
interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

// Extend the Express Request interface to include the user property
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // The 'return' here is fine for control flow, but the signature must be void
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  console.log(token);

  try {
    const decoded = jwt.verify(
      token,
      process.env.AUTH_SECRET as string,
    ) as JwtPayload;

    console.log(JSON.stringify(decoded));

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
}
