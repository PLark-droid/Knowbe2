/**
 * LINE Rich Menu Setup Script
 *
 * B型就労支援事業所利用者向けリッチメニューを作成・アップロードする。
 *
 * 処理フロー:
 *   1. SVG -> PNG 画像生成 (2500x1686)
 *   2. Rich Menu 作成 (POST /v2/bot/richmenu)
 *   3. 画像アップロード (POST /v2/bot/richmenu/{richMenuId}/content)
 *   4. デフォルト設定 (POST /v2/bot/user/all/richmenu/{richMenuId})
 *   5. 結果表示
 *
 * Usage: npx tsx --env-file=.env scripts/setup-line-rich-menu.ts
 */

import sharp from 'sharp';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ─── Environment Variables ───────────────────────────────────

const LINE_CHANNEL_ACCESS_TOKEN = process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? '';
const LARK_FORM_ATTENDANCE =
  process.env['LARK_FORM_ATTENDANCE'] ??
  'https://sjpfkixxkhe8.jp.larksuite.com/share/base/shrjpRI6D9yJOWgfjEqiatZ4Oof';
const LARK_FORM_HEALTH_CHECK =
  process.env['LARK_FORM_HEALTH_CHECK'] ??
  'https://sjpfkixxkhe8.jp.larksuite.com/share/base/shrjpVr7zLlVouNqqJp23GMKJpe';
const LARK_FORM_SUPPORT_RECORD =
  process.env['LARK_FORM_SUPPORT_RECORD'] ??
  'https://sjpfkixxkhe8.jp.larksuite.com/share/base/shrjpOBH5RBkH3yh9qa2mb50FFf';

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('LINE_CHANNEL_ACCESS_TOKEN is not set. Aborting.');
  process.exit(1);
}

// ─── Rich Menu Configuration ────────────────────────────────

const MENU_WIDTH = 2500;
const MENU_HEIGHT = 1686;
const HALF_WIDTH = Math.floor(MENU_WIDTH / 2);
const HALF_HEIGHT = Math.floor(MENU_HEIGHT / 2);

interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action:
    | { type: 'uri'; uri: string; label?: string }
    | { type: 'message'; text: string; label?: string };
}

interface RichMenuBody {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
}

const RICH_MENU_BODY: RichMenuBody = {
  size: { width: MENU_WIDTH, height: MENU_HEIGHT },
  selected: true,
  name: 'Knowbe2 メインメニュー',
  chatBarText: 'メニュー',
  areas: [
    {
      bounds: { x: 0, y: 0, width: HALF_WIDTH, height: HALF_HEIGHT },
      action: { type: 'uri', uri: LARK_FORM_ATTENDANCE, label: '勤怠入力' },
    },
    {
      bounds: { x: HALF_WIDTH, y: 0, width: HALF_WIDTH, height: HALF_HEIGHT },
      action: { type: 'uri', uri: LARK_FORM_HEALTH_CHECK, label: '体調チェック' },
    },
    {
      bounds: { x: 0, y: HALF_HEIGHT, width: HALF_WIDTH, height: HALF_HEIGHT },
      action: { type: 'uri', uri: LARK_FORM_SUPPORT_RECORD, label: '支援記録' },
    },
    {
      bounds: { x: HALF_WIDTH, y: HALF_HEIGHT, width: HALF_WIDTH, height: HALF_HEIGHT },
      action: { type: 'message', text: 'メニュー', label: 'メニュー' },
    },
  ],
};

// ─── Menu Cell Definitions (for image generation) ────────────

interface MenuCell {
  /** Label displayed in the cell */
  label: string;
  /** Grid column (0 or 1) */
  col: number;
  /** Grid row (0 or 1) */
  row: number;
  /** Icon SVG path or text glyph */
  iconPath: string;
  /** Background accent colour */
  accentColor: string;
}

const CELLS: MenuCell[] = [
  {
    label: '勤怠入力',
    col: 0,
    row: 0,
    iconPath:
      'M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2H7zm-2 6h14v12H5V8zm2 2v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2z',
    accentColor: '#43B581',
  },
  {
    label: '体調チェック',
    col: 1,
    row: 0,
    iconPath:
      'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    accentColor: '#E8768A',
  },
  {
    label: '支援記録',
    col: 0,
    row: 1,
    iconPath:
      'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h8v2H8v-2zm0-3h8v2H8v-2z',
    accentColor: '#5B9BD5',
  },
  {
    label: 'メニュー',
    col: 1,
    row: 1,
    iconPath:
      'M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-4.2-5.78v1.75l3.2-2.99L12.8 9v1.7c-3.11.43-4.35 2.56-4.8 4.7 1.11-1.55 2.69-2.18 4.8-2.18z',
    accentColor: '#E8A54B',
  },
];

// ─── SVG Image Generation ───────────────────────────────────

/**
 * Build an SVG string that represents the 2500x1686 rich menu image.
 *
 * Since node-canvas / Pango may not be available, we create a pure SVG
 * and let sharp (which bundles librsvg) render it to PNG.
 *
 * Note: We embed a data URI font stylesheet for Noto Sans JP so that
 * Japanese text renders correctly even in headless environments. As a
 * fallback, common system fonts (Hiragino, Yu Gothic, etc.) are listed.
 */
function buildRichMenuSvg(): string {
  const cellWidth = HALF_WIDTH;
  const cellHeight = HALF_HEIGHT;
  const pad = 20; // padding between cells
  const cornerRadius = 40;
  const bgColor = '#D5D5D5'; // gray background behind cells

  const fontFamily =
    "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Noto Sans JP', sans-serif";

  let cellsSvg = '';

  for (const cell of CELLS) {
    const x = cell.col * cellWidth;
    const y = cell.row * cellHeight;
    const centerX = x + cellWidth / 2;
    const centerY = y + cellHeight / 2;

    // Solid color rounded rectangle (inset with padding)
    const rx = x + pad;
    const ry = y + pad;
    const rw = cellWidth - pad * 2;
    const rh = cellHeight - pad * 2;
    cellsSvg += `
      <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"
            rx="${cornerRadius}" ry="${cornerRadius}" fill="${cell.accentColor}"/>
    `;

    // White icon (scaled from 24x24 SVG path)
    const iconScale = 8;
    const iconSize = 24 * iconScale;
    const iconX = centerX - iconSize / 2;
    const iconY = centerY - iconSize / 2 - 100;
    cellsSvg += `
      <g transform="translate(${iconX}, ${iconY}) scale(${iconScale})">
        <path d="${cell.iconPath}" fill="#FFFFFF" />
      </g>
    `;

    // White label text
    const textY = centerY + iconSize / 2 - 30;
    cellsSvg += `
      <text x="${centerX}" y="${textY}" text-anchor="middle"
            font-family="${fontFamily}" font-size="100" font-weight="bold"
            fill="#FFFFFF">${cell.label}</text>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${MENU_WIDTH}" height="${MENU_HEIGHT}"
     viewBox="0 0 ${MENU_WIDTH} ${MENU_HEIGHT}">
  <rect width="${MENU_WIDTH}" height="${MENU_HEIGHT}" fill="${bgColor}"/>
  ${cellsSvg}
</svg>`;
}

/**
 * Generate the rich menu PNG image (2500x1686) and return it as a Buffer.
 */
async function generateRichMenuImage(): Promise<Buffer> {
  console.log('[RichMenu] Generating 2500x1686 PNG image from SVG ...');

  const svg = buildRichMenuSvg();

  // Write SVG to temp file for debugging if needed
  const svgPath = join(tmpdir(), 'knowbe2-richmenu.svg');
  await writeFile(svgPath, svg, 'utf-8');
  console.log(`[RichMenu]   SVG written to: ${svgPath}`);

  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(MENU_WIDTH, MENU_HEIGHT)
    .png()
    .toBuffer();

  console.log(`[RichMenu]   PNG generated: ${pngBuffer.length} bytes`);
  return pngBuffer;
}

// ─── LINE Messaging API Helpers ─────────────────────────────

const LINE_API_BASE = 'https://api.line.me';
const LINE_API_DATA_BASE = 'https://api-data.line.me';

interface LineApiError {
  message: string;
  details?: unknown;
}

/**
 * Make a JSON request to the LINE Messaging API.
 */
async function lineApiFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const url = `${LINE_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as LineApiError;
    throw new Error(
      `LINE API error [${method} ${path}]: ${res.status} ${res.statusText} - ${JSON.stringify(errorBody)}`,
    );
  }

  // Some endpoints return empty body (204 etc.)
  const text = await res.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

/**
 * Upload binary content to the LINE API data endpoint.
 */
async function lineApiUploadBinary(
  path: string,
  contentType: string,
  data: Buffer,
): Promise<void> {
  const url = `${LINE_API_DATA_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(data),
  });

  if (!res.ok) {
    const errorBody = (await res.text().catch(() => '')) as string;
    throw new Error(
      `LINE API upload error [POST ${path}]: ${res.status} ${res.statusText} - ${errorBody}`,
    );
  }
}

// ─── Rich Menu Operations ───────────────────────────────────

/**
 * Step 1: Create the rich menu object and return its ID.
 */
async function createRichMenu(): Promise<string> {
  console.log('[RichMenu] Step 1: Creating rich menu ...');

  const result = await lineApiFetch<{ richMenuId: string }>(
    '/v2/bot/richmenu',
    'POST',
    RICH_MENU_BODY,
  );

  console.log(`[RichMenu]   Created: ${result.richMenuId}`);
  return result.richMenuId;
}

/**
 * Step 2: Upload the PNG image to the rich menu.
 */
async function uploadRichMenuImage(richMenuId: string, pngBuffer: Buffer): Promise<void> {
  console.log(`[RichMenu] Step 2: Uploading image to rich menu ${richMenuId} ...`);

  await lineApiUploadBinary(
    `/v2/bot/richmenu/${richMenuId}/content`,
    'image/png',
    pngBuffer,
  );

  console.log('[RichMenu]   Image uploaded successfully');
}

/**
 * Step 3: Set the rich menu as the default for all users.
 */
async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  console.log(`[RichMenu] Step 3: Setting as default rich menu ...`);

  await lineApiFetch(
    `/v2/bot/user/all/richmenu/${richMenuId}`,
    'POST',
  );

  console.log('[RichMenu]   Default rich menu set successfully');
}

/**
 * (Optional) Delete the current default rich menu before creating a new one.
 */
async function deleteCurrentDefaultRichMenu(): Promise<void> {
  try {
    const current = await lineApiFetch<{ richMenuId: string }>(
      '/v2/bot/user/all/richmenu',
      'GET',
    );
    if (current.richMenuId) {
      console.log(`[RichMenu] Removing current default: ${current.richMenuId}`);
      await lineApiFetch(`/v2/bot/user/all/richmenu`, 'DELETE');
      await lineApiFetch(`/v2/bot/richmenu/${current.richMenuId}`, 'DELETE');
      console.log('[RichMenu]   Previous default removed');
    }
  } catch {
    // No existing default -- that is fine
    console.log('[RichMenu] No existing default rich menu found (OK)');
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('=== Knowbe2 LINE Rich Menu Setup ===');
  console.log('');

  // Optionally save the PNG locally for inspection
  const savePath = join(tmpdir(), 'knowbe2-richmenu.png');

  // Step 0: Remove previous default (if any)
  await deleteCurrentDefaultRichMenu();

  // Step 1: Generate image
  const pngBuffer = await generateRichMenuImage();
  await writeFile(savePath, pngBuffer);
  console.log(`[RichMenu]   PNG saved to: ${savePath}`);

  // Step 2: Create rich menu
  const richMenuId = await createRichMenu();

  // Step 3: Upload image
  await uploadRichMenuImage(richMenuId, pngBuffer);

  // Step 4: Set as default
  await setDefaultRichMenu(richMenuId);

  // Cleanup temp SVG
  try {
    await unlink(join(tmpdir(), 'knowbe2-richmenu.svg'));
  } catch {
    // ignore cleanup errors
  }

  // Summary
  console.log('');
  console.log('=== Setup Complete ===');
  console.log('');
  console.log(`  Rich Menu ID : ${richMenuId}`);
  console.log(`  Image Size   : ${MENU_WIDTH} x ${MENU_HEIGHT}`);
  console.log(`  Areas        : ${RICH_MENU_BODY.areas.length}`);
  console.log('');
  console.log('  Area details:');
  for (const area of RICH_MENU_BODY.areas) {
    const actionDesc =
      area.action.type === 'uri'
        ? `URI -> ${area.action.uri}`
        : `Message -> "${area.action.text}"`;
    const b = area.bounds;
    console.log(`    [${b.x},${b.y} ${b.width}x${b.height}] ${actionDesc}`);
  }
  console.log('');
  console.log(`  Local PNG    : ${savePath}`);
  console.log('');
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
