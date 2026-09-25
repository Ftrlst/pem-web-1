import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();
    const response = context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>();
    const requestId = request.requestId || randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    return next.handle().pipe(tap(() => undefined));
  }
}
