// apps/api/src/payment/gateways/payment-gateway.interface.ts
// TDD 4.4 明确要求的支付适配器接口

export interface PaymentGateway {
  /**
   * 创建充值订单
   */
  createOrder(paymentId: string, amount: bigint, userId: string, psysCid?: string): Promise<{
    payUrl?: string;
    qrCode?: string;
    redirectUrl?: string;
    extra?: any;
  }>;

  /**
   * 验证回调签名（真实网关必须实现）
   */
  verifyCallback(rawBody: any, headers: any): Promise<boolean>;

  /**
   * 从回调中提取支付信息
   */
  parseCallback(rawBody: any): Promise<{
    orderId: string;
    amount: bigint;
    success: boolean;
    gatewayTransactionId?: string;
    status?: string;
  }>;
}
