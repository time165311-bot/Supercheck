export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  position?: string; // e.g. 'วิสัญญีแพทย์' | 'พยาบาลวิสัญญี' | 'เจ้าหน้าที่'
  signature?: string; // Base64 data URL for digital signature
  active: boolean;
  salt: string;
  hash: string;
  must: boolean;
  created: string;
  last: string;
  avatar?: string;
  ringColor?: string;
}

export interface EquipmentItem {
  id?: string;
  name: string;
  code?: string; // หมายเลขพัสดุ
  sap?: string;  // รหัสสินทรัพย์ SAP
  spec?: string; // มาตรฐานและคุณลักษณะเฉพาะ
  source?: string; // แหล่งเงินที่มา
  date?: string; // วันเดือนปีที่ได้มา
  qty?: string;  // จำนวนตามบัญชี
  tax?: string;  // อัตราภาษี (%)
  price?: string; // ราคา (รวมภาษี)
  location?: string; // สถานที่ตั้ง
  img?: string;
  no?: string;   // ลำดับ
  exp?: string;  // วันหมดอายุ (YYYY-MM-DD)
  note?: string;
}

export interface CheckItemState {
  result: 'ปกติ' | 'ผิดปกติ' | '';
  note?: string;
  val?: string; // numeric count or custom reading, e.g. "1400/1700 PSI", "2"
  weekVals?: { [week: number]: string };
}

export interface CheckItemRow extends EquipmentItem {
  group: string;
  key: string;
  gi: number;
  idx: number;
  result: 'ปกติ' | 'ผิดปกติ' | '';
  note: string;
  val?: string;
}

export interface RoomDef {
  id: string;
  n: string;     // Room name
  l: string;     // Display label with pipe
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
  m: number;     // Interactive room?
  seed?: number; // Pre-seed equipment?
}

export interface GroupConfig {
  [groupName: string]: EquipmentItem[];
}

export interface ListConfig {
  title: string;
  sheet: string;
  groups: GroupConfig;
  noExp?: boolean;
}

export interface AuditLogEntry {
  id: string;
  time: string;
  timestamp?: string;
  user: string;
  name: string;
  action: 'เข้าสู่ระบบ' | 'ออกจากระบบ' | 'เพิ่มรายการ' | 'แก้ไขรายการ' | 'ลบรายการ' | 'เช็คของ' | 'บันทึกผลการตรวจสอบ' | 'เปลี่ยนสิทธิ์ผู้ใช้' | 'เปลี่ยนรหัสผ่าน' | 'ตั้งค่าระบบ' | 'อัปเดตรูปโปรไฟล์';
  details: string;
  location?: string;
}

export interface ExpiryAlertItem {
  item: EquipmentItem;
  category: 'bag' | 'cart';
  categoryTitle: string;
  groupName: string;
  daysRemaining: number;
  status: 'expired' | 'warning' | 'good';
}

export type ThemeMode = 'light' | 'dark';

export interface InspectionHistoryRecord {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  who: string;
  type: 'eq' | 'bag' | 'cart' | 'drug';
  title: string;
  rows: Array<{
    no?: string;
    code?: string;
    sap?: string;
    name: string;
    spec?: string;
    source?: string;
    date?: string;
    qty?: string;
    tax?: string;
    price?: string;
    location?: string;
    res: string;
    note?: string;
  }>;
}

export type DrugCategory = 'monthly' | 'quarterly' | 'adhoc';

export interface DrugItem {
  id: string;
  category: DrugCategory;
  name: string;
  remaining: number;       // คงเหลือ
  receivedDate: string;    // วันที่รับ (YYYY-MM-DD)
  receivedQty: number;     // จำนวนที่รับ
  minStock: number;        // ยอดต่ำสุด
  batchRequest: string;    // เบิกครั้งละ
  unit?: string;           // หน่วยนับ เช่น amp, vial, box, ขวด, หลอด
  expDate: string;         // วันหมดอายุ (YYYY-MM-DD)
  note: string;            // หมายเหตุ
  img?: string;            // รูปภาพยา/สารน้ำ (Base64 หรือ URL)
  barcode?: string;        // รหัสบาร์โค้ด / รหัสยา
}
