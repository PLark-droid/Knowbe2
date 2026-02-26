/**
 * サービスコード検索エンジン
 * LRUキャッシュでマスタデータを高速検索
 */

import { LRUCache } from 'lru-cache';
import type { ServiceCode } from '../types/domain.js';

/** 地域区分単価テーブル (1級地〜7級地, その他) */
export const AREA_UNIT_PRICES: Record<number, number> = {
  1: 11.40,  // 1級地 (東京特別区)
  2: 11.12,  // 2級地
  3: 11.05,  // 3級地
  4: 10.84,  // 4級地
  5: 10.70,  // 5級地
  6: 10.42,  // 6級地
  7: 10.14,  // 7級地
  0: 10.00,  // その他
};

/** B型就労支援の基本報酬単位数 (報酬体系 × 定員区分) */
export const BASE_REWARD_UNITS: Record<string, Record<string, number>> = {
  // 報酬体系Ⅰ (平均工賃月額による)
  I: {
    '4.5万円以上': 702,
    '3.5万円以上4.5万円未満': 672,
    '3万円以上3.5万円未満': 647,
    '2.5万円以上3万円未満': 622,
    '2万円以上2.5万円未満': 597,
    '1.5万円以上2万円未満': 572,
    '1万円以上1.5万円未満': 547,
    '5千円以上1万円未満': 522,
    '5千円未満': 502,
  },
  // 報酬体系Ⅱ (利用者数による)
  II: {
    '20人以下': 567,
    '21〜40人': 527,
    '41〜60人': 502,
    '61〜80人': 477,
    '81人以上': 457,
  },
  // 報酬体系Ⅲ〜Ⅵ (利用者数による)
  III: {
    '20人以下': 556,
    '21〜40人': 546,
    '41〜60人': 536,
    '61〜80人': 526,
    '81人以上': 516,
    default: 556,
  },
  IV: {
    '20人以下': 516,
    '21〜40人': 506,
    '41〜60人': 496,
    '61〜80人': 486,
    '81人以上': 476,
    default: 516,
  },
  V: {
    '20人以下': 506,
    '21〜40人': 496,
    '41〜60人': 486,
    '61〜80人': 476,
    '81人以上': 466,
    default: 506,
  },
  VI: {
    '20人以下': 486,
    '21〜40人': 476,
    '41〜60人': 466,
    '61〜80人': 456,
    '81人以上': 446,
    default: 486,
  },
};

/** 主な加算コード */
export const ADDITION_CODES: Record<string, { name: string; units: number }> = {
  '612211': { name: '送迎加算(Ⅰ) 片道', units: 21 },
  '612212': { name: '送迎加算(Ⅱ) 片道', units: 10 },
  '612311': { name: '食事提供体制加算', units: 30 },
  '612411': { name: '目標工賃達成指導員配置加算(Ⅰ)', units: 70 },
  '612412': { name: '目標工賃達成指導員配置加算(Ⅱ)', units: 36 },
  '612511': { name: '福祉専門職員配置等加算(Ⅰ)', units: 15 },
  '612512': { name: '福祉専門職員配置等加算(Ⅱ)', units: 10 },
  '612513': { name: '福祉専門職員配置等加算(Ⅲ)', units: 6 },
  '612611': { name: '欠席時対応加算', units: 94 },
  '612711': { name: '医療連携体制加算(Ⅰ)', units: 32 },
};

export class ServiceCodeEngine {
  private readonly cache = new LRUCache<string, ServiceCode>({
    max: 500,
    ttl: 1000 * 60 * 30, // 30分
  });

  constructor(private readonly codes: ServiceCode[] = []) {
    for (const code of codes) {
      this.cache.set(code.code, code);
    }
  }

  /** コードで検索 */
  findByCode(code: string): ServiceCode | undefined {
    const cached = this.cache.get(code);
    if (cached) return cached;

    const found = this.codes.find((c) => c.code === code);
    if (found) {
      this.cache.set(code, found);
    }
    return found;
  }

  /** 指定日に有効なコード一覧 */
  findAllValid(date: string): ServiceCode[] {
    return this.codes.filter(
      (c) => c.validFrom <= date && (!c.validTo || c.validTo >= date),
    );
  }

  /** 加算コード一覧 */
  findAdditions(): ServiceCode[] {
    return this.codes.filter((c) => c.isAddition);
  }

  /** 地域区分単価を取得 */
  static getAreaUnitPrice(areaGrade: number): number {
    return AREA_UNIT_PRICES[areaGrade] ?? AREA_UNIT_PRICES[0]!;
  }

  /** 基本報酬単位数を取得 */
  static getBaseRewardUnits(rewardStructure: string, category: string): number {
    const structure = BASE_REWARD_UNITS[rewardStructure];
    if (!structure) return 0;
    return structure[category] ?? structure['default'] ?? 0;
  }
}
