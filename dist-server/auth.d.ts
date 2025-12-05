import type { Request, Response, NextFunction } from 'express';
export interface User {
    email: string;
    passwordHash: string;
    createdAt: string;
    isAdmin: boolean;
}
export interface AuthRequest extends Request {
    user?: {
        email: string;
        isAdmin: boolean;
    };
}
export declare function getUserDataDir(email: string): string;
export declare function getUserDocsDir(email: string): string;
export declare function register(email: string, password: string, inviteCode: string): Promise<{
    success: boolean;
    error?: string;
    token?: string;
}>;
export declare function login(email: string, password: string): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    isAdmin?: boolean;
}>;
export declare function changePassword(email: string, oldPassword: string, newPassword: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function generateInviteCode(adminEmail: string, targetEmail: string): Promise<{
    success: boolean;
    error?: string;
    code?: string;
}>;
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void;
export declare const DEMO_DATA_DIR: string;
export declare const DEMO_DOCS_DIR: string;
