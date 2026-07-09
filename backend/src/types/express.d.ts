// Augment Express's Request with the authenticated student id, set by requireAuth.
import "express";

declare global {
  namespace Express {
    interface Request {
      studentId?: number;
    }
  }
}

export {};
