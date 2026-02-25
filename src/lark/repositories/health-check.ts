/**
 * HealthCheckRepository
 *
 * Link型フィールド ('事業所', '利用者') には Lark record_id を書き込み、
 * ドメインモデルの facilityId / userId は テキスト型フィールドから読み取る。
 */

import type { HealthCheck } from '../../types/domain.js';
import type { LarkBitableRecord } from '../../types/lark.js';
import type { BitableClient } from '../client.js';
import { sanitizeLarkFilterValue } from '../sanitize.js';
import { toLinkValue } from '../link-helpers.js';
import type { LinkResolver } from '../link-resolver.js';

const FIELD = {
  FACILITY: '事業所',
  FACILITY_ID: '事業所ID', // テキスト型 (フィルタ検索用 + 業務ID読み取り)
  USER: '利用者',
  USER_ID: '利用者ID', // テキスト型 (フィルタ検索用 + 業務ID読み取り)
  DATE: '日付',
  SCORE: '体調スコア',
  SLEEP_HOURS: '睡眠時間',
  BREAKFAST: '朝食',
  LUNCH: '昼食',
  DINNER: '夕食',
  MOOD: '気分',
  NOTE: '備考',
  CREATED_AT: '作成日時',
} as const;

function parseScore(raw: unknown): HealthCheck['score'] {
  const n = Number(String(raw ?? '3').trim().charAt(0));
  if (n >= 1 && n <= 5) return n as HealthCheck['score'];
  return 3;
}

function toScoreLabel(score: HealthCheck['score']): string {
  const map: Record<HealthCheck['score'], string> = {
    1: '1 (とても悪い)',
    2: '2 (悪い)',
    3: '3 (普通)',
    4: '4 (良い)',
    5: '5 (とても良い)',
  };
  return map[score];
}

/**
 * Lark レコード -> ドメインエンティティ変換。
 * 業務IDはテキスト型フィールドから読み取る。
 */
function toEntity(record: LarkBitableRecord): HealthCheck {
  const f = record.fields as Record<string, unknown>;
  return {
    id: record.record_id,
    facilityId: String(f[FIELD.FACILITY_ID] ?? ''),
    userId: String(f[FIELD.USER_ID] ?? ''),
    date: String(f[FIELD.DATE] ?? ''),
    score: parseScore(f[FIELD.SCORE]),
    sleepHours: f[FIELD.SLEEP_HOURS] != null ? Number(f[FIELD.SLEEP_HOURS]) : undefined,
    meals: {
      breakfast: Boolean(f[FIELD.BREAKFAST]),
      lunch: Boolean(f[FIELD.LUNCH]),
      dinner: Boolean(f[FIELD.DINNER]),
    },
    mood: f[FIELD.MOOD] != null ? String(f[FIELD.MOOD]) : undefined,
    note: f[FIELD.NOTE] != null ? String(f[FIELD.NOTE]) : undefined,
    createdAt: String(f[FIELD.CREATED_AT] ?? ''),
  };
}

function toBaseFields(entity: Partial<HealthCheck>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entity.facilityId !== undefined) {
    fields[FIELD.FACILITY_ID] = entity.facilityId;
  }
  if (entity.userId !== undefined) {
    fields[FIELD.USER_ID] = entity.userId;
  }
  if (entity.date !== undefined) fields[FIELD.DATE] = entity.date;
  if (entity.score !== undefined) fields[FIELD.SCORE] = toScoreLabel(entity.score);
  if (entity.sleepHours !== undefined) fields[FIELD.SLEEP_HOURS] = entity.sleepHours;
  if (entity.meals !== undefined) {
    fields[FIELD.BREAKFAST] = entity.meals.breakfast;
    fields[FIELD.LUNCH] = entity.meals.lunch;
    fields[FIELD.DINNER] = entity.meals.dinner;
  }
  if (entity.mood !== undefined) fields[FIELD.MOOD] = entity.mood;
  if (entity.note !== undefined) fields[FIELD.NOTE] = entity.note;
  if (entity.createdAt !== undefined) fields[FIELD.CREATED_AT] = entity.createdAt;

  // タイトル列: 体調キーを自動生成
  if (entity.date !== undefined || entity.userId !== undefined) {
    const date = entity.date ?? '';
    const userId = entity.userId ?? '';
    fields['体調キー'] = `${date}_${userId}`;
  }

  return fields;
}

export class HealthCheckRepository {
  constructor(
    private readonly client: BitableClient,
    private readonly tableId: string,
    private readonly linkResolver?: LinkResolver,
  ) {}

  /** Link 型フィールドの record_id を解決してフィールドに追加する */
  private async resolveLinks(
    fields: Record<string, unknown>,
    entity: Partial<HealthCheck>,
  ): Promise<void> {
    if (!this.linkResolver) return;

    if (entity.facilityId !== undefined) {
      const recordId = await this.linkResolver.resolve('facility', entity.facilityId);
      if (recordId) {
        fields[FIELD.FACILITY] = toLinkValue(recordId);
      }
    }
    if (entity.userId !== undefined) {
      const recordId = await this.linkResolver.resolve('user', entity.userId);
      if (recordId) {
        fields[FIELD.USER] = toLinkValue(recordId);
      }
    }
  }

  async findAll(facilityId: string): Promise<HealthCheck[]> {
    const records = await this.client.listAll(this.tableId, {
      filter: `CurrentValue.[${FIELD.FACILITY_ID}]="${sanitizeLarkFilterValue(facilityId)}"`,
    });
    return records.map(toEntity);
  }

  async findById(id: string, expectedFacilityId: string): Promise<HealthCheck | null> {
    const record = await this.client.get(this.tableId, id);
    const entity = toEntity(record);
    return entity.facilityId === expectedFacilityId ? entity : null;
  }

  async create(data: Omit<HealthCheck, 'id'>): Promise<HealthCheck> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.create(this.tableId, fields);
    return toEntity(record);
  }

  async update(id: string, data: Partial<HealthCheck>): Promise<HealthCheck> {
    const fields = toBaseFields(data);
    await this.resolveLinks(fields, data);
    const record = await this.client.update(this.tableId, id, fields);
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.tableId, id);
  }
}
