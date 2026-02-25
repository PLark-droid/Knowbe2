/**
 * LINE User ID - 利用者マッピングサービス
 *
 * LINE userId から事業所の利用者 (ServiceUser) を検索し、
 * 初回登録フローで受給者証番号による紐付けを行う。
 *
 * @module line/user-mapping
 */
import type { ServiceUser } from '../types/domain.js';

/** UserMappingService の依存インターフェース */
export interface UserMappingDeps {
  /** LINE user ID から利用者を検索 */
  findUserByLineId: (lineUserId: string) => Promise<ServiceUser | null>;
  /** 受給者証番号から利用者を検索 */
  findUserByRecipientNumber: (recipientNumber: string) => Promise<ServiceUser | null>;
  /** 利用者の LINE user ID を更新 */
  updateUserLineId: (userId: string, lineUserId: string) => Promise<void>;
}

/**
 * LINE userId と ServiceUser のマッピングサービス
 *
 * インメモリキャッシュにより同一セッション内での
 * 繰り返し DB アクセスを回避する。
 */
export class UserMappingService {
  /** In-memory cache: lineUserId -> ServiceUser */
  private readonly cache = new Map<string, ServiceUser>();

  constructor(private readonly deps: UserMappingDeps) {}

  /**
   * LINE user ID から利用者を検索する (キャッシュ付き)
   *
   * @param lineUserId - LINE user ID
   * @returns 紐付いた ServiceUser、未登録の場合は null
   */
  async findUser(lineUserId: string): Promise<ServiceUser | null> {
    const cached = this.cache.get(lineUserId);
    if (cached) return cached;

    const user = await this.deps.findUserByLineId(lineUserId);
    if (user) {
      this.cache.set(lineUserId, user);
    }
    return user;
  }

  /**
   * 初回登録: 受給者証番号で利用者を検索し、LINE ID を紐付ける
   *
   * @param lineUserId      - LINE user ID
   * @param recipientNumber - 受給者証番号 (10桁)
   * @returns 紐付けに成功した ServiceUser、該当なしの場合は null
   */
  async registerUser(
    lineUserId: string,
    recipientNumber: string,
  ): Promise<ServiceUser | null> {
    const user = await this.deps.findUserByRecipientNumber(recipientNumber);
    if (!user) return null;

    await this.deps.updateUserLineId(user.id, lineUserId);
    const updatedUser: ServiceUser = { ...user, lineUserId };
    this.cache.set(lineUserId, updatedUser);
    return updatedUser;
  }

  /** キャッシュをクリアする */
  clearCache(): void {
    this.cache.clear();
  }
}
