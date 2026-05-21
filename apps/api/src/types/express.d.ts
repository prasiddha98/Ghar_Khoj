import { Request } from "express";

declare global {
  namespace Express {
    interface User {
      id: number;
      role: string;
    }

    // We declare Request.user as present to reflect that our auth middleware
    // attaches a user object for authenticated routes. Be careful: unprotected
    // routes may not have `user` set at runtime.
    interface Request {
      user: User;
    }
  }
}

export {};
