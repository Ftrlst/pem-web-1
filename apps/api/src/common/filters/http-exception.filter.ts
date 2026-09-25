import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof exceptionResponse === 'object' &&
            exceptionResponse &&
            'message' in exceptionResponse
          ? (exceptionResponse as { message: string | string[] }).message
          : 'Terjadi kesalahan pada server';
    const code =
      typeof exceptionResponse === 'object' && exceptionResponse && 'error' in exceptionResponse
        ? (exceptionResponse as { error: string }).error
        : HttpStatus[status] || 'INTERNAL_SERVER_ERROR';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${JSON.stringify(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message: Array.isArray(message) ? message.join(', ') : message,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
