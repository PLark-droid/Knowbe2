/**
 * CSVフィールドフォーマッター
 * ゼロパディング、全角変換、日付書式など
 */

/** 数値をゼロパディング */
export function zeroPad(value: number | string, length: number): string {
  return String(value).padStart(length, '0');
}

/** 右側スペースパディング */
export function spacePad(value: string, length: number): string {
  return value.padEnd(length, ' ');
}

/** 半角カナ → 全角カナ変換 */
export function toFullWidthKana(str: string): string {
  const kanaMap: Record<string, string> = {
    'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ﾝ': 'ン',
    'ﾞ': '゛', 'ﾟ': '゜',
  };

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    const next = str[i + 1];
    // 濁音・半濁音処理
    if (next === 'ﾞ' || next === 'ﾟ') {
      const combined = char + next;
      const dakutenMap: Record<string, string> = {
        'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
        'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
        'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
        'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
        'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
        'ｳﾞ': 'ヴ',
      };
      if (dakutenMap[combined]) {
        result += dakutenMap[combined];
        i++; // skip next char
        continue;
      }
    }
    result += kanaMap[char] ?? char;
  }
  return result;
}

/** 半角数字 → 全角数字変換 */
export function toFullWidthNumber(str: string): string {
  return str.replace(/[0-9]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0xFEE0),
  );
}

/** Date を YYYYMMDD 形式に変換 */
export function formatDateCompact(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** YYYY-MM を YYYYMM 形式に変換 */
export function formatYearMonthCompact(yearMonth: string): string {
  return yearMonth.replace('-', '');
}

/** 性別をコードに変換 */
export function genderToCode(gender: 'male' | 'female' | 'other'): '1' | '2' {
  return gender === 'male' ? '1' : '2';
}

/** CSV用にフィールドをエスケープ (ダブルクォート) */
export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
