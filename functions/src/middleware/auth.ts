import {NextFunction, Request, Response} from "express";
import {getAuth} from "firebase-admin/auth";

export interface AuthenticatedRequest extends Request {
  requestId?: string;
  user?: {
    uid: string;
    email?: string;
  };
  appCheck?: {
    appId: string;
    source: "token" | "smoke_bypass";
  };
}

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const decoded = await getAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch {
    next();
  }
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    res.status(401).json({error: {code: "unauthenticated", message: "Authentication is required."}});
    return;
  }

  next();
};
