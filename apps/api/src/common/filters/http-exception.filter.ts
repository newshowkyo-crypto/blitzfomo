// apps/api/src/common/filters/http-exception.filter.ts
// 全局异常处理 + 错误码映射（严格遵循 API_CONTRACT）

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodes } from '@blitz/shared/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let code = ErrorCodes.INTERNAL_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      const res = exception.getResponse() as any;

      if (typeof res === 'string') {
        message = res;
      } else if (res.code) {
        code = res.code;
        message = res.message || res.msg || 'Business error';
      } else {
        message = res.message || exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 记录错误日志
    if (status >= 500) {
      this.logger.error(
        `[${request.method} ${request.url}] ${message}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json({
      code,
      data: null,
      msg: message,
      requestId: (request as any).requestId || 'unknown',
    });
  }
}