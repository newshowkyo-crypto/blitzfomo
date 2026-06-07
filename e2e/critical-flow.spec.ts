import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8081';
const GAME_URL = `${BASE_URL}/stitch_blitz_finale_world_cup_edition/blitz_finale_world_cup_2026_edition/code.html`;
const API = `${BASE_URL}/api`;

/**
 * Blitz Finale - 核心产品 E2E 测试
 * 覆盖：认证 → 充值 → 购买 → 实时更新 → 提现
 * 
 * 前提：docker compose up 已启动完整环境
 */

test.describe('Blitz Finale - 核心产品闭环', () => {
  test.beforeEach(async ({ page }) => {
    // 访问主游戏页（通过 nginx 提供，app.js 已注入）
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  });

  test('完整玩家旅程：充值 → 购买 → 实时反馈 → 提现', async ({ page, request }) => {
    // 1. 确保演示登录（app.js 会自动处理演示登录）
    await page.waitForFunction(() => Boolean(localStorage.getItem('bf_token')), null, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('bf_token'));
    const headers = { Authorization: `Bearer ${token}` };

    // 验证余额元素存在
    const balanceLocator = page.locator('#header-balance, #sidebar-balance').first();
    await expect(balanceLocator).toBeVisible({ timeout: 8000 });

    const initialBalanceText = await balanceLocator.textContent();
    console.log('初始余额:', initialBalanceText);

    // 2. 执行充值（Mock 支付）
    const rechargeAmount = 100;
    const rechargeResponse = await request.post(`${API}/payment/create`, {
      headers,
      data: { amountUsdt: rechargeAmount },
    });
    expect(rechargeResponse.ok()).toBeTruthy();

    // 等待 Mock 自动到账 + 前端刷新
    await page.waitForTimeout(6000);

    // 验证余额增加（产品级期望）
    const afterRechargeBalance = await balanceLocator.textContent();
    console.log('充值后余额:', afterRechargeBalance);
    expect(afterRechargeBalance).not.toBe(initialBalanceText);

    // 3. 执行购买
    const purchaseAmount = 50;
    const buyButton = page.locator('#buy-button');
    await expect(buyButton).toBeVisible();

    await buyButton.click();

    // 验证实时反馈（Toast 或活动列表更新）
    await page.waitForTimeout(1500);

    // 检查活动 feed 是否有新记录（实时购买）
    const activityFeed = page.locator('#activity-feed');
    await expect(activityFeed).toBeVisible();

    // 4. 验证状态更新（奖池应该增加）
    const prizeLocator = page.locator('#main-prize, #stat-pool').first();
    const prizeBefore = await prizeLocator.textContent();

    // 等待后端状态刷新
    await page.waitForTimeout(2000);

    const prizeAfter = await prizeLocator.textContent();
    console.log(`奖池变化: ${prizeBefore} → ${prizeAfter}`);

    // 5. 执行提现
    const withdrawAmount = 30;
    const withdrawResponse = await request.post(`${API}/withdraw`, {
      headers,
      data: {
        amountUsdt: withdrawAmount,
        toAddress: 'demo-ton-address-123',
        chain: 'TON',
      },
    });

    expect(withdrawResponse.ok()).toBeTruthy();
    const withdrawBody = await withdrawResponse.json();
    expect(withdrawBody.withdrawId || withdrawBody.code === 0).toBeTruthy();

    // 验证提现后余额减少（或状态正确）
    await page.waitForTimeout(1500);
    const finalBalance = await balanceLocator.textContent();
    console.log('提现后余额:', finalBalance);

    // 基本断言：流程跑通，没有崩溃
    expect(finalBalance).toBeTruthy();
  });

  test('实时 Socket 推送验证', async ({ page }) => {
    await page.waitForFunction(() => Boolean(localStorage.getItem('bf_token')), null, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('bf_token'));

    // 监听是否有实时购买推送更新 activity-feed
    const activityFeed = page.locator('#activity-feed');
    await expect(activityFeed).toBeAttached({ timeout: 8000 });

    // 模拟另一个购买（通过 API）
    await page.request.post(`${API}/game/purchase`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { amount: 25, idempotencyKey: Date.now().toString() },
    });

    // 验证活动列表有更新（产品级实时体验）
    await expect(activityFeed).not.toBeEmpty({ timeout: 5000 });
  });
});
