import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Protects administrative trigger, sync, and broadcast routes with X-Admin-Key
 * using constant-time comparison against process.env.ADMIN_API_KEY.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rawHeader = request.headers?.['x-admin-key'];
    const provided = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const expected = process.env.ADMIN_API_KEY?.trim();

    if (!expected || typeof provided !== 'string' || !provided.trim()) {
      throw new UnauthorizedException('Valid X-Admin-Key header is required');
    }

    const providedBuf = Buffer.from(provided.trim(), 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid X-Admin-Key header');
    }

    return true;
  }
}
