import { AuthenticatedUser } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthenticatedUser;
      rawBody?: Buffer;
    }
  }
}

export {};
