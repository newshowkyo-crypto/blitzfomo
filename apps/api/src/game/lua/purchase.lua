-- apps/api/src/game/lua/purchase.lua
-- Blitz Finale 抢购原子脚本（核心）
--
-- 功能：在 Redis 单线程 + Lua 原子性内完成：
--   1. 校验轮次是否已结束（deadline）
--   2. 校验最低购买金额
--   3. 奖池累加
--   4. 倒计时重置为 60s
--   5. 更新 lastBuyer
--
-- 返回值：
--   成功：{ prizePool, deadline, lastBuyer }
--   失败：{ errorCode }  (见下方错误码)
--
-- 调用方式（Node.js ioredis）：
--   const result = await redis.evalsha(luaSha, 1, `round:state:${roundId}`, amount, userId, nickname, minBuy, now)
--
-- 铁律：任何奖池和倒计时变更必须走此脚本，严禁在应用层直接操作 Redis

local roundKey = KEYS[1]

local amount = tonumber(ARGV[1])      -- 购买金额（最小单位 bigint 转 number）
local userId = ARGV[2]
local nickname = ARGV[3]
local minBuy = tonumber(ARGV[4])
local now = tonumber(ARGV[5])         -- 当前时间戳（毫秒）

-- 读取当前 round 状态
local state = redis.call('HMGET', roundKey, 'prizePool', 'deadline', 'lastBuyer', 'status')
local prizePool = tonumber(state[1]) or 0
local deadline = tonumber(state[2]) or 0
local lastBuyer = state[3]
local status = state[4]

-- 错误码定义（与后端 ErrorCodes 保持一致）
local ERR_ROUND_ENDED = -40002
local ERR_BELOW_MIN = -40003
local ERR_INVALID = -40004

-- 1. 校验轮次状态
if status == 'SETTLED' or status == 'CANCELLED' then
    return { ERR_ROUND_ENDED }
end

-- 2. 校验是否已过 deadline
if now >= deadline then
    return { ERR_ROUND_ENDED }
end

-- 3. 校验最低购买
if amount < minBuy then
    return { ERR_BELOW_MIN }
end

-- 4. 原子更新
local newPrizePool = prizePool + amount
local newDeadline = now + (60 * 1000) -- 固定 60 秒，可从 game_config 读取后传入

redis.call('HSET', roundKey,
    'prizePool', newPrizePool,
    'deadline', newDeadline,
    'lastBuyer', userId,
    'lastBuyerNickname', nickname,
    'updatedAt', now
)

-- 5. 记录最近购买（用于实时推送）
local purchaseLogKey = 'round:purchases:' .. string.match(roundKey, ':(.+)')
redis.call('LPUSH', purchaseLogKey, cjson.encode({
    userId = userId,
    nickname = nickname,
    amount = amount,
    ts = now
}))
redis.call('LTRIM', purchaseLogKey, 0, 49) -- 只保留最近 50 条

-- 返回最新状态给调用方
return {
    newPrizePool,
    newDeadline,
    userId,
    nickname
}