import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware";
import { UserRole } from "../utils/interfaces";

export function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // authMiddleware should have already run and populated req.user
  if (!req.user) {
    res.status(401).json({ error: "Authentication error" });
    return;
  }

  if (req.user.role !== UserRole.ADMIN) {
    res
      .status(403)
      .json({ error: "Access denied. Admin privileges required." });
    return;
  }

  next();
}
