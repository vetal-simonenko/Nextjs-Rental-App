import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

interface CognitoPayload {
  sub: string;
  'custom:role'?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export const authMiddleware = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      const payload = (await verifier.verify(token)) as CognitoPayload;

      const userRole = payload['custom:role'] || '';

      req.user = {
        id: payload.sub,
        role: userRole,
      };

      const allowed = allowedRoles.map((role) => role.toLowerCase());
      const hasAccess = allowed.includes(userRole.toLowerCase());

      if (!hasAccess) {
        res.status(403).json({ message: 'Access Denied' });
        return;
      }

      next();
    } catch (err) {
      console.error('Failed to verify Cognito token:', err);
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
};
