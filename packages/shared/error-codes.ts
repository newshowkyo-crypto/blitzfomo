// packages/shared/error-codes.ts
// 全局错误码（前后端严格复用，禁止魔法字符串）

export const ErrorCodes = {
  SUCCESS: 0,
  INSUFFICIENT_BALANCE: 40001,
  ROUND_ENDED: 40002,
  BELOW_MIN_BUY: 40003,
  INVALID_AMOUNT: 40004,
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  OPERATOR_NOT_ALLOWED: 40302,
  DUPLICATE_REQUEST: 40901,
  WITHDRAW_RISK_BLOCKED: 42201,
  RATE_LIMITED: 42901,
  INTERNAL_ERROR: 50000,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];