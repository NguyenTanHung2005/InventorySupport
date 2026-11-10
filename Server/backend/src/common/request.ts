import { Request } from 'express';
import { AuthUser } from './types.js';

export type AuthenticatedRequest = Request & { user: AuthUser };
