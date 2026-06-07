import { Injectable } from '@nestjs/common';
import { Prisma, RoadPool, RoadStage, Team } from '@prisma/client';

type RoadPoolParams = {
  liquidityDepth?: number;
  alpha?: number;
  gamma?: number;
  eta?: number;
  shockFactor?: number;
  heatFactor?: number;
  minPrice?: number;
  maxPrice?: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getImpliedProbability(team: Team, stage: RoadStage) {
  switch (stage) {
    case RoadStage.TOP32:
      return team.impliedTop32;
    case RoadStage.TOP16:
      return team.impliedTop16;
    case RoadStage.TOP8:
      return team.impliedTop8;
    case RoadStage.TOP4:
      return team.impliedTop4;
    case RoadStage.FINAL:
      return team.impliedFinal;
    case RoadStage.CHAMPION:
      return team.impliedChampion;
    default:
      return null;
  }
}

@Injectable()
export class RoadPricingService {
  calculate(pool: RoadPool, team: Team, now: Date) {
    const params = (pool.params || {}) as RoadPoolParams;
    const basePrice = Number(pool.basePrice);
    const strengthFactor = Number(team.strengthFactor);

    const implied = getImpliedProbability(team, pool.stage);
    const impliedProbability = implied ? Number(implied) : 0.5;
    const survivalRaw = 1 / Math.max(impliedProbability, 1e-6);
    const survivalFactor = clampNumber(survivalRaw, 0.7, 3.0);

    const soldKeys = Number(pool.soldKeys);
    const liquidityDepth = Math.max(Number(params.liquidityDepth ?? 500), 1);
    const alpha = Math.max(Number(params.alpha ?? 1.35), 0);
    const demandCurve = Math.pow(1 + soldKeys / liquidityDepth, alpha);

    const heatFactor = Math.max(Number(params.heatFactor ?? 1.0), 0);
    const shockFactor = Math.max(Number(params.shockFactor ?? 1.0), 0);

    let timePressure = 1;
    if (pool.openAt && pool.closeAt) {
      const total = Math.max(pool.closeAt.getTime() - pool.openAt.getTime(), 1);
      const left = clampNumber(pool.closeAt.getTime() - now.getTime(), 0, total);
      const progress = 1 - left / total;
      const gamma = Math.max(Number(params.gamma ?? 0.35), 0);
      const eta = Math.max(Number(params.eta ?? 2.2), 0);
      timePressure = 1 + gamma * Math.pow(progress, eta);
    }

    const rawPrice =
      basePrice *
      strengthFactor *
      survivalFactor *
      demandCurve *
      timePressure *
      heatFactor *
      shockFactor;

    const minPrice = Number(params.minPrice ?? Math.max(1, basePrice * 0.4));
    const maxPrice = Number(params.maxPrice ?? Math.max(minPrice, basePrice * 200));
    const clamped = clampNumber(rawPrice, minPrice, maxPrice);
    const rounded = Math.max(1, Math.floor(clamped));

    return {
      price: BigInt(rounded),
      meta: {
        basePrice,
        strengthFactor,
        survivalFactor,
        demandCurve,
        timePressure,
        heatFactor,
        shockFactor,
        minPrice,
        maxPrice,
        soldKeys,
        liquidityDepth,
        alpha,
      },
    };
  }

  toDecimal(value: bigint) {
    return new Prisma.Decimal(value.toString());
  }
}

