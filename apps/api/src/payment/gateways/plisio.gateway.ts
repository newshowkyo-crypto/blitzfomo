import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class PlisioGateway implements PaymentGateway {
  private readonly apiBase = process.env.PLISIO_API_BASE || 'https://api.plisio.net/api/v1';

  async createOrder(paymentId: string, amount: bigint, userId: string, psysCid?: string) {
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey) {
      throw new Error('PLISIO_API_KEY is not configured');
    }

    const publicApiBaseUrl = process.env.PUBLIC_API_BASE_URL || process.env.APP_PUBLIC_URL;
    if (!publicApiBaseUrl) {
      throw new Error('PUBLIC_API_BASE_URL is not configured');
    }

    const amountUsdt = (Number(amount) / 100).toFixed(2);
    const callbackUrl = `${publicApiBaseUrl.replace(/\/$/, '')}/api/payment/webhook/plisio?json=true`;
    const params = new URLSearchParams({
      api_key: apiKey,
      source_currency: process.env.PLISIO_SOURCE_CURRENCY || 'USD',
      source_amount: amountUsdt,
      order_number: paymentId,
      order_name: `Blitz Fomo deposit ${paymentId}`,
      description: `Blitz Fomo World Cup deposit for ${userId}`,
      callback_url: callbackUrl,
      success_callback_url: process.env.PLISIO_SUCCESS_URL || process.env.TMA_PUBLIC_URL || publicApiBaseUrl,
      fail_callback_url: process.env.PLISIO_FAIL_URL || process.env.TMA_PUBLIC_URL || publicApiBaseUrl,
      success_invoice_url: process.env.PLISIO_SUCCESS_URL || process.env.TMA_PUBLIC_URL || publicApiBaseUrl,
      fail_invoice_url: process.env.PLISIO_FAIL_URL || process.env.TMA_PUBLIC_URL || publicApiBaseUrl,
      email: `${userId}@blitzfomo.local`,
      language: 'en_US',
      expire_min: process.env.PLISIO_EXPIRE_MIN || '60',
      return_existing: 'true',
    });

    const selectedCid = (psysCid || '').trim();
    const allowedCurrencies = process.env.PLISIO_ALLOWED_PSYS_CIDS;
    if (selectedCid) {
      // 用户在前端选定的币种：锁定发票币种，避免展示白名单外的币种
      params.set('allowed_psys_cids', selectedCid);
      params.set('currency', selectedCid);
    } else if (allowedCurrencies) {
      params.set('allowed_psys_cids', allowedCurrencies);
      const firstCurrency = allowedCurrencies.split(',').map((item) => item.trim()).filter(Boolean)[0];
      if (firstCurrency) params.set('currency', firstCurrency);
    } else if (process.env.PLISIO_CURRENCY) {
      params.set('currency', process.env.PLISIO_CURRENCY);
    }

    const response = await fetch(`${this.apiBase}/invoices/new?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json();

    if (!response.ok || payload?.status === 'error') {
      const message = payload?.data?.message || payload?.message || 'Plisio invoice creation failed';
      throw new Error(message);
    }

    const data = payload?.data || payload;
    return {
      payUrl: data.invoice_url,
      redirectUrl: data.invoice_url,
      qrCode: data.qr_code,
      extra: {
        provider: 'plisio',
        gatewayOrderId: data.txn_id,
        invoiceUrl: data.invoice_url,
        raw: data,
      },
    };
  }

  async verifyCallback(rawBody: any): Promise<boolean> {
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey || !rawBody || typeof rawBody !== 'object' || !rawBody.verify_hash) {
      return false;
    }

    const ordered = { ...rawBody };
    const verifyHash = String(ordered.verify_hash);
    delete ordered.verify_hash;

    const expected = createHmac('sha1', apiKey).update(JSON.stringify(ordered)).digest('hex');
    return expected === verifyHash;
  }

  async parseCallback(rawBody: any) {
    const orderId = rawBody?.order_number || rawBody?.orderNumber || '';
    const status = String(rawBody?.status || '').toLowerCase();
    const sourceAmount = rawBody?.source_amount || rawBody?.sourceAmount || rawBody?.invoice_total_sum || 0;

    // 仅 'completed' 自动入账。'mismatch'（实付金额与发票不符，可能是少付）
    // 不自动按订单全额入账，留待后台人工核对链上实付金额后再手动标记，
    // 避免少付被当作全额到账造成资金损失。
    return {
      orderId,
      amount: BigInt(Math.floor(Number(sourceAmount || 0) * 100)),
      success: status === 'completed',
      gatewayTransactionId: rawBody?.txn_id,
      status,
    };
  }
}
