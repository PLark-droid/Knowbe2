/**
 * LINE統合型定義
 */

export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: LineMessage;
  postback?: LinePostback;
}

export interface LineMessage {
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  id: string;
  text?: string;
}

export interface LinePostback {
  data: string;
  params?: {
    date?: string;
    time?: string;
    datetime?: string;
  };
}

export interface LineRichMenuConfig {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: LineRichMenuArea[];
}

export interface LineRichMenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: LineAction;
}

export type LineAction =
  | { type: 'postback'; data: string; displayText?: string }
  | { type: 'uri'; uri: string }
  | { type: 'message'; text: string };

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: LineFlexContainer;
}

export type LineFlexContainer =
  | LineFlexBubble
  | LineFlexCarousel;

export interface LineFlexBubble {
  type: 'bubble';
  header?: LineFlexBox;
  hero?: LineFlexImage;
  body?: LineFlexBox;
  footer?: LineFlexBox;
}

export interface LineFlexCarousel {
  type: 'carousel';
  contents: LineFlexBubble[];
}

export interface LineFlexBox {
  type: 'box';
  layout: 'horizontal' | 'vertical' | 'baseline';
  contents: LineFlexComponent[];
  spacing?: string;
  margin?: string;
  paddingAll?: string;
  backgroundColor?: string;
}

export interface LineFlexImage {
  type: 'image';
  url: string;
  size?: string;
  aspectRatio?: string;
  aspectMode?: string;
}

export type LineFlexComponent =
  | LineFlexBox
  | LineFlexText
  | LineFlexButton
  | LineFlexSeparator
  | LineFlexImage;

export interface LineFlexText {
  type: 'text';
  text: string;
  size?: string;
  weight?: string;
  color?: string;
  wrap?: boolean;
  align?: string;
  flex?: number;
}

export interface LineFlexButton {
  type: 'button';
  action: LineAction;
  style?: 'primary' | 'secondary' | 'link';
  color?: string;
  height?: string;
}

export interface LineFlexSeparator {
  type: 'separator';
  margin?: string;
  color?: string;
}

/** LINE user → ServiceUser mapping */
export interface LineUserMapping {
  lineUserId: string;
  serviceUserId: string;
  facilityId: string;
  registeredAt: string;
}
