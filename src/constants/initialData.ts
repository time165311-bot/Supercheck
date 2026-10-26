import { ListConfig, RoomDef } from '../types';

/**
 * INITIAL_MASTER_DATA
 * ผู้ใช้สามารถนำเนื้อหาทั้งหมดจากไฟล์ master_app_data.json ที่ดาวน์โหลดมาวางทับค่าตัวแปรนี้ได้
 * เพื่อให้ AI Studio Preview โหลดและซิงค์ข้อมูลให้เหมือนกับหน้าเว็บจริง 100%
 */
export const INITIAL_MASTER_DATA: any = null;

export const ROOMS: RoomDef[] = [
  { id: 'or3', n: 'OR 3', l: 'OR 3', x: 255, y: 595, w: 130, h: 325, c: '#0ea5e9', m: 1, seed: 1 },
  { id: 'or2', n: 'OR 2', l: 'OR 2', x: 385, y: 595, w: 147, h: 325, c: '#0ea5e9', m: 1, seed: 1 },
  { id: 'or1', n: 'OR 1', l: 'OR 1', x: 532, y: 595, w: 152, h: 325, c: '#0ea5e9', m: 1, seed: 1 },
  { id: 'pacu', n: 'ห้องพักฟื้น', l: 'พัก|ฟื้น', x: 684, y: 605, w: 100, h: 315, c: '#8b5cf6', m: 1, seed: 1 },
  { id: 'ster', n: 'ห้องเก็บ Sterile', l: 'Sterile', x: 788, y: 605, w: 78, h: 315, c: '#64748b', m: 1, seed: 0 },
  { id: 'mn1', n: 'MINOR 1', l: 'MINOR|1', x: 866, y: 610, w: 85, h: 310, c: '#06b6d4', m: 1, seed: 1 },
  { id: 'mn2', n: 'MINOR 2', l: 'MINOR|2', x: 953, y: 610, w: 92, h: 310, c: '#06b6d4', m: 1, seed: 1 },
  { id: 'mn3', n: 'MINOR 3', l: 'MINOR 3', x: 1053, y: 515, w: 138, h: 150, c: '#06b6d4', m: 1, seed: 1 },
  { id: 'tool', n: 'ห้องจัดเครื่องมือ', l: 'จัด|เครื่องมือ', x: 313, y: 920, w: 150, h: 100, c: '#0ea5e9', m: 1, seed: 0 },
  { id: 'sup', n: 'ห้องเก็บพัสดุ', l: 'เก็บ|พัสดุ', x: 1088, y: 928, w: 98, h: 100, c: '#64748b', m: 1, seed: 0 },
  { id: 'anes', n: 'ห้องวิสัญญี', l: 'ห้อง|วิสัญญี', x: 782, y: 1028, w: 164, h: 200, c: '#f59e0b', m: 1, seed: 0 },
  { id: 'prep', n: 'ห้องเตรียมก่อนผ่าตัด', l: 'เตรียม|ก่อนผ่าตัด', x: 778, y: 1228, w: 160, h: 240, c: '#3b82f6', m: 1, seed: 0 },
  { id: 'linen', n: 'ห้องผ้า', l: 'ห้องผ้า', x: 775, y: 1468, w: 158, h: 140, c: '#64748b', m: 1, seed: 0 },
  { id: 'store', n: 'ห้องเก็บของ', l: 'ห้อง|เก็บของ', x: 771, y: 1608, w: 158, h: 138, c: '#64748b', m: 1, seed: 1 },
  { id: 'recv', n: 'ห้องรับผู้ป่วย', l: 'รับผู้ป่วย', x: 536, y: 1420, w: 142, h: 140, c: '#3b82f6', m: 1, seed: 0 },
  { id: 'nurse', n: 'เคาน์เตอร์พยาบาล', l: 'เคาน์เตอร์', x: 534, y: 1176, w: 146, h: 50, c: '#3b82f6', m: 1, seed: 0 },
  { id: 'd1', n: '', l: 'น้ำชาย', x: 88, y: 1120, w: 105, h: 150, c: '#cbd5e1', m: 0 },
  { id: 'd2', n: '', l: 'น้ำหญิง', x: 96, y: 1270, w: 98, h: 147, c: '#cbd5e1', m: 0 },
  { id: 'd3', n: '', l: 'อาหาร', x: 108, y: 1513, w: 95, h: 187, c: '#cbd5e1', m: 0 },
  { id: 'd4', n: '', l: 'พัก จนท.', x: 205, y: 1700, w: 125, h: 92, c: '#cbd5e1', m: 0 },
  { id: 'd5', n: '', l: 'เปลี่ยนชุดชาย', x: 320, y: 1223, w: 145, h: 98, c: '#cbd5e1', m: 0 },
  { id: 'd6', n: '', l: 'เปลี่ยนชุดหญิง', x: 320, y: 1321, w: 145, h: 97, c: '#cbd5e1', m: 0 },
  { id: 'd7', n: '', l: 'หัวหน้า', x: 535, y: 1322, w: 72, h: 95, c: '#cbd5e1', m: 0 },
  { id: 'd8', n: '', l: 'บันไดหนีไฟ', x: 1098, y: 665, w: 88, h: 263, c: '#cbd5e1', m: 0 },
  { id: 'd9', n: '', l: 'ลิฟท์', x: 400, y: 1560, w: 68, h: 230, c: '#cbd5e1', m: 0 },
  { id: 'd10', n: '', l: 'ลิฟท์ด้านนอก', x: 536, y: 1560, w: 142, h: 230, c: '#cbd5e1', m: 0 },
];

export const CORRIDORS: [number, number, number, number][] = [
  [165, 490, 888, 115],
  [165, 490, 100, 630],
  [265, 1020, 515, 205],
  [193, 1120, 127, 440],
  [193, 1418, 343, 142],
  [465, 1226, 70, 194],
  [463, 920, 221, 100],
  [684, 920, 404, 108],
  [1045, 665, 53, 263],
  [680, 1020, 98, 780],
];

export const CORRIDOR_LABELS: [string, number, number][] = [
  ['ทางเดินหน้า OR', 573, 978],
  ['ทางเดินหน้า MINOR', 886, 980],
  ['ทางเดินหลัก', 470, 1108],
  ['ทางเดินรอบห้องผ่าตัด', 560, 555],
];

// Helper to get formatted sample future dates
const getSampleExpDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

// ==========================================
// 1. รายการอุปกรณ์ กระเป๋ายา Emergency (BAG)
// ==========================================
export const EMERGENCY_BAG_MASTER_ITEMS = [
  { id: 1, name: 'Laryngoscope blade No.3', amount: '1 อัน', defaultExp: '' },
  { id: 2, name: 'Endotracheal tube No. 4, 5, 5.5, 6.5, 7, 7.5', amount: 'อย่างละ 1 เส้น', defaultExp: '' },
  { id: 3, name: 'Stylet (ใหญ่ / เล็ก)', amount: 'อย่างละ 1 เส้น', defaultExp: '' },
  { id: 4, name: 'Oral airway No. 2, 3, 4', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { id: 5, name: 'Syringe blow cuff', amount: '2 อัน', defaultExp: '' },
  { id: 6, name: 'T-piece / Tube', amount: '1 เส้น', defaultExp: '' },
  { id: 7, name: 'Suction No. 14, 12, 10', amount: 'อย่างละ 1 เส้น', defaultExp: '' },
  { id: 8, name: 'Stethoscope', amount: '1 อัน', defaultExp: '' },
  { id: 9, name: 'Extension tube (ผู้ใหญ่ / เด็ก / T-way)', amount: '1 set (1, 1/2 อัน)', defaultExp: '' },
  { id: 10, name: 'เข็มฉีดยา No. 18, 20, 21, 25', amount: 'อย่างละ 2 เข็ม', defaultExp: '' },
  { id: 11, name: 'Syringe 3cc, 5cc, 10cc', amount: 'อย่างละ 2 อัน', defaultExp: '' },
  { id: 12, name: 'IV catheter No. 18, 20, 22, 24', amount: 'อย่างละ 2 เส้น', defaultExp: '' },
  { id: 13, name: 'Tourniquet', amount: '1 เส้น', defaultExp: '' },
  { id: 14, name: 'Alcohol', amount: '1 กระปุก', defaultExp: '' },
  { id: 15, name: '5% D/W/2 500 CC', amount: '1/2 ขวด', defaultExp: '' },
  { id: 16, name: '0.9% NSS 100 CC / 500cc / 10cc', amount: '1/1/2 ขวด', defaultExp: '' },
  { id: 17, name: 'Sterile water 10 cc', amount: '3 ขวด', defaultExp: '' },
  { id: 18, name: 'Tensoplast', amount: '3 อัน', defaultExp: '' },
  { id: 19, name: 'Betadine / Ammonia', amount: '1, 1 ขวด', defaultExp: '' },
  { id: 20, name: 'สำลีก้อน, ถุงมือ', amount: '1 แผง, 1 คู่', defaultExp: '' },
  { id: 21, name: 'Micropore, Transpore, พลาสเตอร์ไร้เสี้ยน', amount: '1, 1 เส้น', defaultExp: '' }
];

// ==========================================
// 2. รายการอุปกรณ์ รถ Emergency (CAR)
// ==========================================
export const EMERGENCY_CAR_MASTER_ITEMS = [
  // --- หมวดที่ 1: อุปกรณ์สำหรับใส่ท่อช่วยหายใจ ---
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 101, name: '1. Laryngoscope + blade No. 1, 2', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 102, name: 'Laryngoscope + blade No. 3, 4', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 103, name: '2. Endotracheal tube No. 4, 5, 5.5, 6', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 104, name: 'Endotracheal tube No. 6.5, 7', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 105, name: 'Endotracheal tube No. 7.5', amount: '1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 106, name: '3. LMA No. 2, 3, 4', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 107, name: '4. Oral airway No. 2, 3, 4', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 108, name: '5. Nasal airway No. 6.5, 7, 7.5', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 109, name: '6. Ambu bag (เด็ก, ผู้ใหญ่)', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 110, name: '7. Face Mask No. 1, 2', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 111, name: 'Face Mask No. 3, 4', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 112, name: '8. O2 Cannula (ผู้ใหญ่)', amount: '1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 113, name: '9. O2 mask (เด็ก, ผู้ใหญ่)', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 114, name: '10. Set พ่นยา', amount: '1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 115, name: '11. สายท่อออกซิเจน', amount: '1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 116, name: '12. สาย Suction No. 10, 12, 14', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 117, name: '13. Stylet (ใหญ่, กลาง, เล็ก)', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 118, name: '14. Magill Forceps', amount: '1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 119, name: '15. K-Y jelly', amount: '1 หลอด', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 120, name: '16. Tape สำหรับยึดท่อช่วยหายใจ', amount: '4 เส้น', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 121, name: '17. Syringe blow cuff', amount: '2 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ', id: 122, name: '18. Stethoscope', amount: '1 อัน', defaultExp: '' },

  // --- หมวดที่ 2: อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ ---
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 201, name: '1. IV Catheter No. 18, 20', amount: 'อย่างละ 2 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 202, name: 'IV Catheter No. 22, 24', amount: 'อย่างละ 2 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 203, name: '2. IV Set (ใหญ่, เล็ก)', amount: 'อย่างละ 2 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 204, name: '3. Three way', amount: '3 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 205, name: '4. Tourniquet, ไม้บล็อก, Transpore', amount: 'อย่างละ 1 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 206, name: '5. Extension tube (ผู้ใหญ่, เด็ก) / Extension with T', amount: 'อย่างละ 1 อัน / 3 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 207, name: '6. เข็มเปิดยา No. 18, 20, 22', amount: 'อย่างละ 2 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 208, name: 'เข็มฉีดยา No. 22, 24', amount: 'อย่างละ 5 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 209, name: '7. Syringe ขนาด 3, 5, 10 cc', amount: 'อย่างละ 5 อัน', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 210, name: '8. สำลีสะอาด, เข็ม', amount: '1 กระปุก, 1 เส้น', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 211, name: '9. Alcohol', amount: '2 ขวด', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 212, name: '10. 5% D/N/2 500 ML', amount: '1 bag', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 213, name: '11. 0.9% NSS 1000 ML', amount: '1 bag', defaultExp: '' },
  { category: 'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ', id: 214, name: '12. Acetar 1000 ML / 5% D/W 500ml', amount: '1 bag / 3 bag', defaultExp: '' },

  // --- หมวดที่ 3: วัสดุและอุปกรณ์เตรียมพร้อมใช้ ---
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 301, name: '13. ไม้ต้มแก้ว', amount: '3 amp', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 302, name: '1. เครื่องวัดสัญญาณชีพ', amount: '1 เครื่อง', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 303, name: '2. เครื่องดูดเสมหะ', amount: '1 เครื่อง', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 304, name: '3. Flow meter', amount: '1 อัน', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 305, name: '4. O2 tank (ถังออกซิเจน)', amount: '2 tank', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 306, name: '5. เครื่อง Defibrillator', amount: '1 เครื่อง', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 307, name: '6. กระเป๋ายาลูกหมาก Emergency drug', amount: '1 กล่อง', defaultExp: '' },
  { category: 'วัสดุและอุปกรณ์เตรียมพร้อมใช้', id: 308, name: '7. กล่องยาสมุนไพร High alert and urgency drug', amount: '1 กล่อง', defaultExp: '' }
];

export const DEFAULT_LISTS: Record<'bag' | 'cart', ListConfig> = {
  bag: {
    title: 'เช็คกระเป๋าอีเมอร์เจนซี่',
    sheet: 'กระเป๋า Emergency',
    groups: {
      'อุปกรณ์ช่วยหายใจ (Airway)': [
        { name: 'Laryngoscope blade No.3', code: 'BAG-01', qty: '1 อัน', spec: 'ใบมีดส่องหลอดลมเบอร์ 3', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '1', exp: '', img: '' },
        { name: 'Endotracheal tube No. 4, 5, 5.5, 6.5, 7, 7.5', code: 'BAG-02', qty: 'อย่างละ 1 เส้น', spec: 'ท่อช่วยหายใจปลอดเชื้อพร้อม cuff', source: 'คลังยา', date: '1 ม.ค. 68', no: '2', exp: getSampleExpDate(180), img: '' },
        { name: 'Stylet (ใหญ่ / เล็ก)', code: 'BAG-03', qty: 'อย่างละ 1 เส้น', spec: 'ลวดนำทางท่อช่วยหายใจ', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '3', exp: '', img: '' },
        { name: 'Oral airway No. 2, 3, 4', code: 'BAG-04', qty: 'อย่างละ 1 อัน', spec: 'ท่อเปิดทางเดินหายใจทางปาก', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '4', exp: getSampleExpDate(240), img: '' },
        { name: 'Syringe blow cuff', code: 'BAG-05', qty: '2 อัน', spec: 'กระบอกฉีดยาสำหรับ blow cuff', source: 'คลังยา', date: '1 ม.ค. 68', no: '5', exp: '', img: '' },
        { name: 'T-piece / Tube', code: 'BAG-06', qty: '1 เส้น', spec: 'สายต่อทางเดินหายใจรูปตัว T', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '6', exp: getSampleExpDate(300), img: '' },
        { name: 'Suction No. 14, 12, 10', code: 'BAG-07', qty: 'อย่างละ 1 เส้น', spec: 'สายดูดเสมหะปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '7', exp: getSampleExpDate(150), img: '' },
        { name: 'Stethoscope', code: 'BAG-08', qty: '1 อัน', spec: 'หูฟังตรวจฟังเสียงปอดและหัวใจ', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '8', exp: '', img: '' },
      ],
      'อุปกรณ์ให้สารน้ำและฉีดยา (IV & Injection)': [
        { name: 'Extension tube (ผู้ใหญ่ / เด็ก / T-way)', code: 'BAG-09', qty: '1 set (1, 1/2 อัน)', spec: 'สายเพิ่มความยาวสายน้ำเกลือพร้อม Three-way', source: 'คลังยา', date: '1 ม.ค. 68', no: '9', exp: getSampleExpDate(90), img: '' },
        { name: 'เข็มฉีดยา No. 18, 20, 21, 25', code: 'BAG-10', qty: 'อย่างละ 2 เข็ม', spec: 'เข็มฉีดยาปลอดเชื้อใช้ครั้งเดียว', source: 'คลังยา', date: '1 ม.ค. 68', no: '10', exp: getSampleExpDate(180), img: '' },
        { name: 'Syringe 3cc, 5cc, 10cc', code: 'BAG-11', qty: 'อย่างละ 2 อัน', spec: 'กระบอกฉีดยาพลาสติกปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '11', exp: getSampleExpDate(210), img: '' },
        { name: 'IV catheter No. 18, 20, 22, 24', code: 'BAG-12', qty: 'อย่างละ 2 เส้น', spec: 'เข็มแทงเปิดเส้นหลอดเลือดดำปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '12', exp: getSampleExpDate(60), img: '' },
        { name: 'Tourniquet', code: 'BAG-13', qty: '1 เส้น', spec: 'สายรัดแขนสำหรับเจาะเลือด/เปิดเส้น', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '13', exp: '', img: '' },
      ],
      'เวชภัณฑ์และสารน้ำ (Solutions & Dressing)': [
        { name: 'Alcohol', code: 'BAG-14', qty: '1 กระปุก', spec: 'แอลกอฮอล์สำหรับเช็ดทำความสะอาดฆ่าเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '14', exp: getSampleExpDate(120), img: '' },
        { name: '5% D/W/2 500 CC', code: 'BAG-15', qty: '1/2 ขวด', spec: 'สารน้ำ 5% Dextrose in 0.45% Sodium Chloride', source: 'คลังยา', date: '1 ม.ค. 68', no: '15', exp: getSampleExpDate(100), img: '' },
        { name: '0.9% NSS 100 CC / 500cc / 10cc', code: 'BAG-16', qty: '1/1/2 ขวด', spec: 'สารละลายน้ำเกลือนอร์มัลซาไลน์ปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '16', exp: getSampleExpDate(150), img: '' },
        { name: 'Sterile water 10 cc', code: 'BAG-17', qty: '3 ขวด', spec: 'น้ำกลั่นปราศจากเชื้อสำหรับฉีด', source: 'คลังยา', date: '1 ม.ค. 68', no: '17', exp: getSampleExpDate(180), img: '' },
        { name: 'Tensoplast', code: 'BAG-18', qty: '3 อัน', spec: 'พลาสเตอร์ปิดแผลสำเร็จรูป', source: 'คลังยา', date: '1 ม.ค. 68', no: '18', exp: getSampleExpDate(90), img: '' },
        { name: 'Betadine / Ammonia', code: 'BAG-19', qty: '1, 1 ขวด', spec: 'น้ำยาฆ่าเชื้อเบตาดีนและแอมโมเนียหอม', source: 'คลังยา', date: '1 ม.ค. 68', no: '19', exp: getSampleExpDate(110), img: '' },
        { name: 'สำลีก้อน, ถุงมือ', code: 'BAG-20', qty: '1 แผง, 1 คู่', spec: 'สำลีชุบแอลกอฮอล์และถุงมือแพทย์ปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '20', exp: getSampleExpDate(45), img: '' },
        { name: 'Micropore, Transpore, พลาสเตอร์ไร้เสี้ยน', code: 'BAG-21', qty: '1, 1 เส้น', spec: 'เทปแต่งแผลทางการแพทย์ไมโครพอร์และทรานสพอร์', source: 'คลังยา', date: '1 ม.ค. 68', no: '21', exp: '', img: '' },
      ],
    },
  },
  cart: {
    title: 'เช็ครถอีเมอร์เจนซี่',
    sheet: 'รถ Emergency',
    groups: {
      'อุปกรณ์สำหรับใส่ท่อช่วยหายใจ': [
        { name: '1. Laryngoscope + blade No. 1, 2', code: 'CAR-101', qty: 'อย่างละ 1 อัน', spec: 'ชุดส่องกล่องเสียงด้ามพร้อมใบมีดเบอร์ 1 และ 2', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '1', exp: '', img: '' },
        { name: 'Laryngoscope + blade No. 3, 4', code: 'CAR-102', qty: 'อย่างละ 1 อัน', spec: 'ชุดส่องกล่องเสียงด้ามพร้อมใบมีดเบอร์ 3 และ 4', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '2', exp: '', img: '' },
        { name: '2. Endotracheal tube No. 4, 5, 5.5, 6', code: 'CAR-103', qty: 'อย่างละ 1 อัน', spec: 'ท่อช่วยหายใจเด็ก-ผู้ใหญ่ขนาดเล็กปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '3', exp: getSampleExpDate(180), img: '' },
        { name: 'Endotracheal tube No. 6.5, 7', code: 'CAR-104', qty: 'อย่างละ 1 อัน', spec: 'ท่อช่วยหายใจผู้ใหญ่เบอร์ 6.5 และ 7.0 ชนิดมี cuff', source: 'คลังยา', date: '1 ม.ค. 68', no: '4', exp: getSampleExpDate(210), img: '' },
        { name: 'Endotracheal tube No. 7.5', code: 'CAR-105', qty: '1 อัน', spec: 'ท่อช่วยหายใจผู้ใหญ่เบอร์ 7.5 ชนิดมี cuff ปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '5', exp: getSampleExpDate(240), img: '' },
        { name: '3. LMA No. 2, 3, 4', code: 'CAR-106', qty: 'อย่างละ 1 อัน', spec: 'หน้ากากครอบกล่องเสียง LMA เบอร์ 2, 3, 4', source: 'คลังยา', date: '1 ม.ค. 68', no: '6', exp: getSampleExpDate(150), img: '' },
        { name: '4. Oral airway No. 2, 3, 4', code: 'CAR-107', qty: 'อย่างละ 1 อัน', spec: 'ท่อเปิดทางเดินหายใจทางปากเบอร์ 2, 3, 4', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '7', exp: getSampleExpDate(300), img: '' },
        { name: '5. Nasal airway No. 6.5, 7, 7.5', code: 'CAR-108', qty: 'อย่างละ 1 อัน', spec: 'ท่อเปิดทางเดินหายใจทางจมูกเบอร์ 6.5, 7, 7.5', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '8', exp: getSampleExpDate(270), img: '' },
        { name: '6. Ambu bag (เด็ก, ผู้ใหญ่)', code: 'CAR-109', qty: 'อย่างละ 1 อัน', spec: 'ลูกสูบช่วยหายใจกู้ชีพพร้อมถุงสำรองออกซิเจน', source: 'เงินงบประมาณ', date: '1 ม.ค. 68', no: '9', exp: '', img: '' },
        { name: '7. Face Mask No. 1, 2', code: 'CAR-110', qty: 'อย่างละ 1 อัน', spec: 'หน้ากากครอบจมูกและปากขนาดเด็กเบอร์ 1, 2', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '10', exp: '', img: '' },
        { name: 'Face Mask No. 3, 4', code: 'CAR-111', qty: 'อย่างละ 1 อัน', spec: 'หน้ากากครอบจมูกและปากขนาดผู้ใหญ่เบอร์ 3, 4', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '11', exp: '', img: '' },
        { name: '8. O2 Cannula (ผู้ใหญ่)', code: 'CAR-112', qty: '1 อัน', spec: 'สายออกซิเจนแคนนูลาสำหรับผู้ใหญ่', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '12', exp: getSampleExpDate(180), img: '' },
        { name: '9. O2 mask (เด็ก, ผู้ใหญ่)', code: 'CAR-113', qty: 'อย่างละ 1 อัน', spec: 'หน้ากากให้ออกซิเจนชนิดเด็กและผู้ใหญ่', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '13', exp: getSampleExpDate(240), img: '' },
        { name: '10. Set พ่นยา', code: 'CAR-114', qty: '1 อัน', spec: 'ชุดอุปกรณ์สำหรับพ่นยาขยายหลอดลม (Nebulizer kit)', source: 'คลังยา', date: '1 ม.ค. 68', no: '14', exp: getSampleExpDate(120), img: '' },
        { name: '11. สายท่อออกซิเจน', code: 'CAR-115', qty: '1 อัน', spec: 'สายท่อยางต่อถังออกซิเจน', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '15', exp: '', img: '' },
        { name: '12. สาย Suction No. 10, 12, 14', code: 'CAR-116', qty: 'อย่างละ 1 อัน', spec: 'สายดูดเสมหะปลอดเชื้อเบอร์ 10, 12, 14', source: 'คลังยา', date: '1 ม.ค. 68', no: '16', exp: getSampleExpDate(200), img: '' },
        { name: '13. Stylet (ใหญ่, กลาง, เล็ก)', code: 'CAR-117', qty: 'อย่างละ 1 อัน', spec: 'ลวดนำทางท่อช่วยหายใจ (ใหญ่, กลาง, เล็ก)', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '17', exp: '', img: '' },
        { name: '14. Magill Forceps', code: 'CAR-118', qty: '1 อัน', spec: 'คีมคีบสิ่งแปลกปลอมในทางเดินหายใจสเตนเลส', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '18', exp: '', img: '' },
        { name: '15. K-Y jelly', code: 'CAR-119', qty: '1 หลอด', spec: 'เจลหล่อลื่นปลอดเชื้อชนิดซอง/หลอด', source: 'คลังยา', date: '1 ม.ค. 68', no: '19', exp: getSampleExpDate(150), img: '' },
        { name: '16. Tape สำหรับยึดท่อช่วยหายใจ', code: 'CAR-120', qty: '4 เส้น', spec: 'สายยาง/เทปรัดยึดท่อช่วยหายใจ', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '20', exp: '', img: '' },
        { name: '17. Syringe blow cuff', code: 'CAR-121', qty: '2 อัน', spec: 'กระบอกฉีดยาสำหรับสูบลม cuff ETT', source: 'คลังยา', date: '1 ม.ค. 68', no: '21', exp: '', img: '' },
        { name: '18. Stethoscope', code: 'CAR-122', qty: '1 อัน', spec: 'หูฟังตรวจฟังเสียงปอดและหัวใจ', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '22', exp: '', img: '' },
      ],
      'อุปกรณ์สำหรับให้สารน้ำ/สายทางหลอดเลือดดำ': [
        { name: '1. IV Catheter No. 18, 20', code: 'CAR-201', qty: 'อย่างละ 2 อัน', spec: 'เข็มเปิดเส้นหลอดเลือดดำเบอร์ 18 และ 20', source: 'คลังยา', date: '1 ม.ค. 68', no: '23', exp: getSampleExpDate(90), img: '' },
        { name: 'IV Catheter No. 22, 24', code: 'CAR-202', qty: 'อย่างละ 2 อัน', spec: 'เข็มเปิดเส้นหลอดเลือดดำเบอร์ 22 และ 24', source: 'คลังยา', date: '1 ม.ค. 68', no: '24', exp: getSampleExpDate(120), img: '' },
        { name: '2. IV Set (ใหญ่, เล็ก)', code: 'CAR-203', qty: 'อย่างละ 2 อัน', spec: 'ชุดให้สารน้ำทางหลอดเลือดดำ (หยดมาตรฐานและไมโคร)', source: 'คลังยา', date: '1 ม.ค. 68', no: '25', exp: getSampleExpDate(180), img: '' },
        { name: '3. Three way', code: 'CAR-204', qty: '3 อัน', spec: 'ข้อต่อ 3 ทางสำหรับให้สารน้ำและยา', source: 'คลังยา', date: '1 ม.ค. 68', no: '26', exp: getSampleExpDate(210), img: '' },
        { name: '4. Tourniquet, ไม้บล็อก, Transpore', code: 'CAR-205', qty: 'อย่างละ 1 อัน', spec: 'สายรัดแขน ไม้บล็อกแขน และพลาสเตอร์ทรานสพอร์', source: 'คลังพัสดุ', date: '1 ม.ค. 68', no: '27', exp: '', img: '' },
        { name: '5. Extension tube (ผู้ใหญ่, เด็ก) / Extension with T', code: 'CAR-206', qty: 'อย่างละ 1 อัน / 3 อัน', spec: 'สายต่อเพิ่มความยาวให้สารน้ำผู้ใหญ่และเด็ก', source: 'คลังยา', date: '1 ม.ค. 68', no: '28', exp: getSampleExpDate(140), img: '' },
        { name: '6. เข็มเปิดยา No. 18, 20, 22', code: 'CAR-207', qty: 'อย่างละ 2 อัน', spec: 'เข็มดูดยาเบอร์ 18, 20, 22 ปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '29', exp: getSampleExpDate(180), img: '' },
        { name: 'เข็มฉีดยา No. 22, 24', code: 'CAR-208', qty: 'อย่างละ 5 อัน', spec: 'เข็มฉีดยาเบอร์ 22 และ 24 ปลอดเชื้อ', source: 'คลังยา', date: '1 ม.ค. 68', no: '30', exp: getSampleExpDate(180), img: '' },
        { name: '7. Syringe ขนาด 3, 5, 10 cc', code: 'CAR-209', qty: 'อย่างละ 5 อัน', spec: 'กระบอกฉีดยาปลอดเชื้อขนาด 3, 5, 10 มล.', source: 'คลังยา', date: '1 ม.ค. 68', no: '31', exp: getSampleExpDate(240), img: '' },
        { name: '8. สำลีสะอาด, เข็ม', code: 'CAR-210', qty: '1 กระปุก, 1 เส้น', spec: 'สำลีแอลกอฮอล์และสายรัดเข็ม', source: 'คลังยา', date: '1 ม.ค. 68', no: '32', exp: getSampleExpDate(60), img: '' },
        { name: '9. Alcohol', code: 'CAR-211', qty: '2 ขวด', spec: 'เอทิลแอลกอฮอล์ 70% ฆ่าเชื้อขวดขนาด 450 มล.', source: 'คลังยา', date: '1 ม.ค. 68', no: '33', exp: getSampleExpDate(150), img: '' },
        { name: '10. 5% D/N/2 500 ML', code: 'CAR-212', qty: '1 bag', spec: 'สารน้ำ 5% Dextrose in 0.45% NaCl ขนาด 500 มล.', source: 'คลังยา', date: '1 ม.ค. 68', no: '34', exp: getSampleExpDate(120), img: '' },
        { name: '11. 0.9% NSS 1000 ML', code: 'CAR-213', qty: '1 bag', spec: 'สารน้ำ 0.9% Normal Saline Solution 1,000 มล.', source: 'คลังยา', date: '1 ม.ค. 68', no: '35', exp: getSampleExpDate(150), img: '' },
        { name: '12. Acetar 1000 ML / 5% D/W 500ml', code: 'CAR-214', qty: '1 bag / 3 bag', spec: 'สารน้ำ Acetar 1,000 มล. และ 5% Dextrose in Water 500 มล.', source: 'คลังยา', date: '1 ม.ค. 68', no: '36', exp: getSampleExpDate(180), img: '' },
      ],
      'วัสดุและอุปกรณ์เตรียมพร้อมใช้': [
        { name: '13. ไม้ต้มแก้ว', code: 'CAR-301', qty: '3 amp', spec: 'หลอดแก้วไม้ต้มแก้วทดสอบอุณหภูมิความดัน', source: 'พัสดุทั่วไป', date: '1 ม.ค. 68', no: '37', exp: '', img: '' },
        { name: '1. เครื่องวัดสัญญาณชีพ', code: 'CAR-302', qty: '1 เครื่อง', spec: 'เครื่องติดตามสัญญาณชีพผู้ป่วย (Vital Signs Monitor)', source: 'เงินงบประมาณ', date: '1 ม.ค. 68', no: '38', exp: '', img: '' },
        { name: '2. เครื่องดูดเสมหะ', code: 'CAR-303', qty: '1 เครื่อง', spec: 'เครื่องดูดเสมหะชนิดเคลื่อนย้ายได้พร้อมกระบอกรองรับ', source: 'เงินงบประมาณ', date: '1 ม.ค. 68', no: '39', exp: '', img: '' },
        { name: '3. Flow meter', code: 'CAR-304', qty: '1 อัน', spec: 'อุปกรณ์ควบคุมอัตราการไหลของออกซิเจน', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '40', exp: '', img: '' },
        { name: '4. O2 tank (ถังออกซิเจน)', code: 'CAR-305', qty: '2 tank', spec: 'ถังออกซิเจนสำรองประจำรถ บันทึกค่าแรงดัน PSI (เช่น 1400/1700)', source: 'เงินบำรุง', date: '1 ม.ค. 68', no: '41', exp: '', img: '' },
        { name: '5. เครื่อง Defibrillator', code: 'CAR-306', qty: '1 เครื่อง', spec: 'เครื่องกระตุกหัวใจไฟฟ้า Biphasic พร้อม Paddle', source: 'เงินงบประมาณ', date: '1 ม.ค. 68', no: '42', exp: '', img: '' },
        { name: '6. กระเป๋ายาลูกหมาก Emergency drug', code: 'CAR-307', qty: '1 กล่อง', spec: 'กล่องยากู้ชีพฉุกเฉินปิดผนึกพร้อมใช้งาน', source: 'คลังยา', date: '1 ม.ค. 68', no: '43', exp: getSampleExpDate(90), img: '' },
        { name: '7. กล่องยาสมุนไพร High alert and urgency drug', code: 'CAR-308', qty: '1 กล่อง', spec: 'กล่องยาที่มีความเสี่ยงสูงและยาเร่งด่วน', source: 'คลังยา', date: '1 ม.ค. 68', no: '44', exp: getSampleExpDate(120), img: '' },
      ],
    },
  },
};

export const GAS_SCRIPT_V5 = `/* ============================================================
   ระบบตรวจเช็คอุปกรณ์วิสัญญี — Google Apps Script (Code.gs)
   คุณสมบัติ:
   1. โหมดฟอร์มพิมพ์ A4 อัตโนมัติ (แยกแท็บชีตตามรอบตรวจ พร้อมพิมพ์ A4 ทันที)
   2. ชีต "Audit Log": บันทึกประวัติการส่งรายงานและการกระทำ
   3. ไม่ใช้ DriveApp / UrlFetchApp เพื่อความปลอดภัยและไม่ขอสิทธิ์เกินจำเป็น
   ============================================================ */

// ตั้งค่าโหมดการจัดชีต:
// 'SEPARATE_SHEETS' = เพิ่มแท็บชีตใหม่ทุกรอบตรวจโดยใช้โครงสร้างฟอร์มพิมพ์ A4 ทางการ 14 คอลัมน์ทันที
var WORKBOOK_MODE = 'SEPARATE_SHEETS';

var CFG = {
  font: 'Sarabun',
  bodySize: 11,
  rowHeight: 56,
  minRows: 10,
  colWidths: [40, 110, 95, 110, 160, 85, 70, 48, 42, 80, 110, 50, 50, 50]
};
var NCOL = 14;
var HR = 7;

var SHEET_PRINT = '📋 ฟอร์มพิมพ์_A4';
var SHEET_USERS = 'Users';
var SHEET_AUDIT = 'Audit Log';
var USER_HEAD = ['Username', 'Name', 'Role', 'Active', 'Salt', 'Hash', 'MustChange', 'Created', 'LastLogin'];
var AUDIT_HEAD = ['เวลาบันทึก (Timestamp)', 'บัญชีผู้ใช้ (Username)', 'ชื่อ-นามสกุล', 'การกระทำ (Action)', 'รายละเอียด / ไอเทมที่แก้ไข', 'สถานที่ / ห้อง'];

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var act = (e && e.parameter && (e.parameter.a || e.parameter.action)) || '';
  if (act === 'pull' && ss) {
    return json_({
      status: 'ok',
      message: 'ดึงข้อมูลจาก Google Sheets สำเร็จ',
      data: {}
    });
  }
  return json_({ 
    status: 'ok', 
    message: ss ? ('เชื่อมต่อสำเร็จ - ไฟล์: ' + ss.getName()) : 'สคริปต์ยังไม่ได้ผูกกับ Google Sheet',
    spreadsheetUrl: ss ? ss.getUrl() : '',
    spreadsheetName: ss ? ss.getName() : ''
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var contents = (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return fail_('สคริปต์ไม่ได้ผูกกับ Google Sheet', 'setup');

    var act = String(data.a || data.action || '');

    if (act === 'login') return doLogin_(ss, data);
    if (act === 'audit') return doAuditLog_(ss, data);

    // รับค่าข้อมูลส่งกลับไปให้ฝั่ง React นำไปเรนเดอร์พิมพ์ผ่าน Window Print Engine (A4 แนวนอน)
    if (act === 'export_pdf') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        items: data.items || [],
        surveyDate: data.surveyDate || '',
        locationName: data.locationName || ''
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (act === 'log') {
      var res = doLog_(ss, data);
      doAuditLog_(ss, {
        user: data.user || 'system',
        name: data.who || data.user || 'เจ้าหน้าที่',
        action: 'บันทึกผลการตรวจสอบ',
        details: 'ส่งรายงานตรวจเช็ค ' + (data.title || data.sheet) + ' (' + (data.rows ? data.rows.length : 0) + ' รายการ)',
        location: data.title || '-'
      });
      return res;
    }

    return doLog_(ss, data);
  } catch (err) {
    return fail_(String(err));
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ----------------- จัดการ Audit Log -----------------
function doAuditLog_(ss, d) {
  var sh = ss.getSheetByName(SHEET_AUDIT);
  if (!sh) {
    sh = ss.insertSheet(SHEET_AUDIT);
    sh.getRange(1, 1, 1, AUDIT_HEAD.length).setValues([AUDIT_HEAD])
      .setFontFamily(CFG.font).setFontWeight('bold').setBackground('#f1f5f9');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 120);
    sh.setColumnWidth(3, 140);
    sh.setColumnWidth(4, 150);
    sh.setColumnWidth(5, 260);
    sh.setColumnWidth(6, 140);
  }
  sh.appendRow([
    now_(),
    String(d.user || '-'),
    String(d.name || d.user || '-'),
    String(d.action || '-'),
    String(d.details || '-'),
    String(d.location || '-')
  ]);
  return ok_({ logged: true });
}

// ----------------- ประมวลผลและบันทึกรายงาน -----------------
function doLog_(ss, d) {
  var rows = d.rows || [];
  if (d.type === 'drug') {
    writeDrugReport_(ss, d);
  } else if (d.type === 'bag' || d.type === 'cart') {
    writeEmergencyReport_(ss, d);
  } else {
    writeReport_(ss, d);
  }
  return ok_({ count: rows.length });
}

// ฟังก์ชันเมนูและตั้งค่าหน้ากระดาษ A4 ใน Google Sheets
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏥 ระบบงานวิสัญญี')
      .addItem('🖨️ ตั้งค่าพิมพ์ฟอร์ม A4 แนวนอน (Page Setup)', 'setupActiveSheetA4Landscape')
      .addToUi();
  } catch (e) {}
}

// ฟังก์ชันตั้งค่าหน้ากระดาษ A4 แนวนอน พร้อมพิมพ์ Ctrl+P ได้ทันที
function setupActiveSheetA4Landscape() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getActiveSheet();
  if (!sh) return;
  try {
    sh.setPageSetUp(SpreadsheetApp.PageSize.A4, SpreadsheetApp.Orientation.LANDSCAPE);
    try { sh.setHideGridlines(false); } catch(ge) {}
    ss.toast('ตั้งค่าชีตเป็นฟอร์มพิมพ์ A4 แนวนอนเรียบร้อยแล้ว (กด Ctrl + P ได้ทันที)', 'สำเร็จ', 3);
  } catch(e) {
    SpreadsheetApp.getUi().alert('การตั้งค่าหน้ากระดาษ: ' + e.message);
  }
}

function computeSheetName_(d) {
  if (d.sheetName && String(d.sheetName).trim()) {
    return String(d.sheetName).trim();
  }
  var typeKey = String(d.type || 'eq');
  var dateStr = String(d.date || now_());
  var m = dateStr.match(/^(\\d{4})(?:-(\\d{2}))?(?:-(\\d{2}))?/);
  var yearVal = m && m[1] ? m[1] : new Date().getFullYear().toString();
  var monthVal = m && m[2] ? m[2] : ('0' + (new Date().getMonth() + 1)).slice(-2);
  var dayVal = m && m[3] ? m[3] : ('0' + new Date().getDate()).slice(-2);
  var thaiYear = String(parseInt(yearVal, 10) + 543);
  var dateCode = dayVal + monthVal + thaiYear;

  var locCode = 'ทุกห้อง';
  var rawTitle = String(d.title || d.location || d.sheet || '');
  if (rawTitle.indexOf('OR 1') > -1 || rawTitle.indexOf('OR1') > -1) locCode = 'OR1';
  else if (rawTitle.indexOf('OR 2') > -1 || rawTitle.indexOf('OR2') > -1) locCode = 'OR2';
  else if (rawTitle.indexOf('OR 3') > -1 || rawTitle.indexOf('OR3') > -1) locCode = 'OR3';
  else if (rawTitle.indexOf('PACU') > -1 || rawTitle.indexOf('พักฟื้น') > -1) locCode = 'PACU';
  else if (rawTitle.indexOf('Sterile') > -1) locCode = 'Sterile';
  else if (rawTitle.indexOf('MINOR 1') > -1 || rawTitle.indexOf('MINOR1') > -1) locCode = 'MINOR1';
  else if (rawTitle.indexOf('MINOR 2') > -1 || rawTitle.indexOf('MINOR2') > -1) locCode = 'MINOR2';
  else if (rawTitle.indexOf('MINOR 3') > -1 || rawTitle.indexOf('MINOR3') > -1) locCode = 'MINOR3';

  if (typeKey === 'bag') {
    return 'กระเป๋า_EMER_' + dateCode;
  } else if (typeKey === 'cart') {
    return 'รถ_EMER_' + dateCode;
  } else if (typeKey === 'drug') {
    var catSub = d.category === 'quarterly' ? '3เดือน' : d.category === 'adhoc' ? 'ครั้งคราว' : 'เดือน';
    return 'คลังยา_' + catSub + '_' + dateCode;
  } else {
    return 'ครุภัณฑ์_' + locCode + '_' + dateCode;
  }
}

function getUniqueSheet_(ss, baseName) {
  var targetName = baseName;
  var count = 1;
  while (ss.getSheetByName(targetName)) {
    count++;
    targetName = baseName + '_รอบ' + count;
  }
  return ss.insertSheet(targetName);
}

function writeReport_(ss, data) {
  var sheet;
  if (WORKBOOK_MODE === 'SEPARATE_SHEETS') {
    var baseSheetName = computeSheetName_(data);
    sheet = getUniqueSheet_(ss, baseSheetName);
  } else {
    sheet = ss.getSheetByName(SHEET_PRINT);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_PRINT, 0);
    } else {
      sheet.clear();
    }
  }

  if (sheet.getMaxColumns() < NCOL) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), NCOL - sheet.getMaxColumns());
  }

  try {
    sheet.setPageSetUp(SpreadsheetApp.PageSize.A4, SpreadsheetApp.Orientation.LANDSCAPE);
  } catch (pe) {}

  var maxRows = sheet.getMaxRows();
  try { sheet.setHideGridlines(false); } catch(ge) {}
  sheet.setRowHeights(1, maxRows, 22);
  sheet.getRange(1, 1, maxRows, sheet.getMaxColumns())
       .setFontFamily(CFG.font).setFontSize(CFG.bodySize).setVerticalAlignment('middle');

  for (var c = 0; c < NCOL; c++) sheet.setColumnWidth(c + 1, CFG.colWidths[c]);

  var clinic  = data.title || 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
  var dateTh  = thaiDate_(data.date);
  var who     = data.who || '';
  var dots    = new Array(45).join('.');

  var reportTitle = 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
  if (data.type && String(data.type).indexOf('กระเป๋า') > -1) {
    reportTitle = 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency';
  } else if (data.type && String(data.type).indexOf('รถ') > -1) {
    reportTitle = 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';
  }

  cell_(sheet, 'E1:J1', reportTitle, 15, true, 'center');
  sheet.setRowHeight(1, 26);
  cell_(sheet, 'E2:J2', 'ณ วันที่ ' + dateTh, 12, false, 'center');
  sheet.setRowHeight(2, 22);

  cell_(sheet, 'A3:E3', clinic, 11, false, 'left');
  cell_(sheet, 'A4:F4', 'หัวหน้าภาควิชา/หน่วยงาน ' + dots, 11, false, 'left');
  cell_(sheet, 'I3:N3', 'วัน, เดือน, ปี ที่สำรวจ ' + (dateTh || dots), 11, false, 'right');
  cell_(sheet, 'I4:N4', 'กรรมการผู้ตรวจ ' + (who || dots), 11, false, 'right');

  sheet.setRowHeight(3, 22);
  sheet.setRowHeight(4, 22);

  var heads = [
    'ลำดับที่', 'หมายเลขพัสดุ', 'รหัสสินทรัพย์\\nSAP', 'รายการ',
    'มาตรฐานและ\\nคุณลักษณะเฉพาะ', 'แหล่งเงินที่มา\\n(ประเภท\\nเงินงบประมาณ)',
    'ว/ด/ป\\nที่ได้มา', 'จำนวน\\nตามบัญชี', 'อัตราภาษี\\n(%)', 'ราคา\\n(รวมภาษี)',
    'สถานที่ตั้ง\\nตึก / ชั้น / ห้อง'
  ];
  for (var i = 0; i < heads.length; i++) {
    var h = sheet.getRange(HR, i + 1, 3, 1);
    h.merge();
    h.setValue(heads[i]);
  }
  sheet.getRange(HR, 12, 1, 3).merge().setValue('ผลการตรวจสอบพัสดุ');
  sheet.getRange(HR + 1, 12, 1, 2).merge().setValue('พบรายการ');
  sheet.getRange(HR + 1, 14, 2, 1).merge().setValue('ไม่พบรายการ');
  sheet.getRange(HR + 2, 12).setValue('ใช้งานได้');
  sheet.getRange(HR + 2, 13).setValue('ใช้งาน\\nไม่ได้');

  sheet.getRange(HR, 1, 3, NCOL)
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setWrap(true).setFontWeight('bold').setFontSize(11).setBackground('#f1f5f9');
  sheet.getRange(HR + 1, 12, 2, 3).setFontSize(10);
  sheet.setRowHeight(HR, 26);
  sheet.setRowHeight(HR + 1, 26);
  sheet.setRowHeight(HR + 2, 38);

  var rows = data.rows || [];
  var total = Math.max(rows.length, CFG.minRows);
  var startNo = parseInt(data.startNo, 10) || 1;
  var tax = (data.tax !== undefined && data.tax !== '') ? String(data.tax) : '7';
  var out = [];

  for (var n = 0; n < total; n++) {
    var r = rows[n];
    if (!r) {
      out.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      continue;
    }
    var res = String(r.res || '');
    var ok = '', bad = '', miss = '';
    if (res.indexOf('ไม่พบ') > -1) miss = '✓';
    else if (res.indexOf('ไม่ได้') > -1) bad = '✓';
    else if (res.indexOf('ใช้งานได้') > -1) ok = '✓';

    var loc = r.location || '';
    if (r.note) loc += (loc ? '\\n' : '') + '(' + r.note + ')';

    out.push([
      startNo + n,
      r.code || '-',
      r.sap || '-',
      r.name || '-',
      r.spec || '-',
      r.source || '-',
      r.date || '-',
      r.qty || '1',
      r.tax !== undefined && r.tax !== '' ? String(r.tax) : tax,
      r.price || '-',
      loc || '-',
      ok, bad, miss
    ]);
  }

  var ds = HR + 3;
  var body = sheet.getRange(ds, 1, total, NCOL);
  body.setNumberFormat('@');
  body.setValues(out);
  body.setWrap(true).setVerticalAlignment('top').setFontSize(CFG.bodySize);

  // จัดตำแหน่งทุกคอลัมน์ให้อยู่กึ่งกลางตามที่ผู้ใช้กำหนด (รายการ, ราคา, สถานที่ตั้ง, ว/ด/ป, แหล่งเงิน, ฯลฯ)
  sheet.getRange(ds, 1, total, NCOL).setHorizontalAlignment('center');
  sheet.getRange(ds, 12, total, 3).setVerticalAlignment('middle').setFontSize(13);

  sheet.getRange(HR, 1, 3 + total, NCOL)
       .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  sheet.setRowHeights(ds, total, 42);

  // ส่วนลงชื่อท้ายเอกสาร - ขยายความกว้างเต็ม 14 คอลัมน์ ไม่ให้ข้อความตกหล่นหรือขึ้น "อ......หัวหน้า"
  var signRow = ds + total + 2;
  if (sheet.getMaxRows() < signRow + 3) {
    sheet.insertRowsAfter(sheet.getMaxRows(), 4);
  }
  sheet.getRange(signRow, 2, 1, 6).merge().setValue('ลงชื่อ .................................................... ผู้ตรวจสอบ');
  sheet.getRange(signRow + 1, 2, 1, 6).merge().setValue('(' + (who || '....................................................') + ')');
  sheet.getRange(signRow, 8, 1, 7).merge().setValue('ลงชื่อ .................................................... หัวหน้างาน');
  sheet.getRange(signRow + 1, 8, 1, 7).merge().setValue('(....................................................)');
  sheet.getRange(signRow, 1, 2, NCOL)
       .setFontFamily(CFG.font).setFontSize(10.5)
       .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(false);
  return sheet;
}

function writeEmergencyReport_(ss, data) {
  var isCart = data.type === 'cart';
  var baseName = computeSheetName_(data);
  var sheet = getUniqueSheet_(ss, baseName);
  var nCols = 8;
  if (sheet.getMaxColumns() < nCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), nCols - sheet.getMaxColumns());
  }

  try {
    sheet.setPageSetUp(SpreadsheetApp.PageSize.A4, SpreadsheetApp.Orientation.LANDSCAPE);
  } catch (pe) {}
  try { sheet.setHideGridlines(false); } catch(ge) {}

  var colWidths = [280, 60, 75, 75, 75, 75, 75, 100];
  for (var c = 0; c < nCols; c++) sheet.setColumnWidth(c + 1, colWidths[c]);

  var clinic = data.title || 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
  var dateTh = thaiDate_(data.date);
  var who = data.who || '';
  var activeWk = parseInt(data.week, 10) || 1;

  var mainTitle = isCart
    ? 'ตารางตรวจเช็ครถ Emergency ประจำเดือน ' + (data.monthYear || ('ณ วันที่ ' + dateTh)) + '  หน่วยงาน: ' + clinic
    : 'ตารางตรวจเช็คกระเป๋ายา Emergency ประจำเดือน ' + (data.monthYear || ('ณ วันที่ ' + dateTh));

  cell_(sheet, 'A1:H1', mainTitle, 14, true, 'center');
  sheet.setRowHeight(1, 28);

  var subMeta = clinic + '  |  วัน, เดือน, ปี ที่สำรวจ: ' + (dateTh || '-') + '  |  ผู้ตรวจสอบ: ' + (who || '-');
  cell_(sheet, 'A2:H2', subMeta, 10, false, 'center');
  sheet.setRowHeight(2, 20);

  // Table header: 2 rows (Row 4 & Row 5)
  sheet.getRange(4, 1, 2, 1).merge().setValue('รายการ');
  sheet.getRange(4, 2, 2, 1).merge().setValue('จำนวน');
  for (var w = 1; w <= 5; w++) {
    sheet.getRange(4, 2 + w).setValue('สัปดาห์ที่ ' + w);
    var dateLabel = (data.weekDates && data.weekDates[w]) ? data.weekDates[w] : (activeWk === w ? (dateTh ? dateTh.split(' ')[0] + '/' + (dateTh.split(' ')[1]||'').substring(0,3) : '-') : '-');
    sheet.getRange(5, 2 + w).setValue('ว/ด/ป: ' + dateLabel);
  }
  sheet.getRange(4, 8, 2, 1).merge().setValue('วันหมดอายุ (EXP)');

  sheet.getRange(4, 1, 2, nCols)
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setWrap(true).setFontWeight('bold').setFontSize(10.5).setBackground('#f1f5f9');
  sheet.setRowHeight(4, 24);
  sheet.setRowHeight(5, 22);

  var rows = data.rows || [];
  var total = Math.max(rows.length, 10);
  var out = [];

  for (var n = 0; n < total; n++) {
    var r = rows[n];
    if (!r) {
      out.push(['', '', '', '', '', '', '', '']);
      continue;
    }
    var weekVals = r.weekVals || {};
    var w1 = weekVals[1] !== undefined ? weekVals[1] : (activeWk === 1 ? (r.val || (r.res && r.res.indexOf('ใช้งานได้') > -1 ? '✓' : '-')) : '-');
    var w2 = weekVals[2] !== undefined ? weekVals[2] : (activeWk === 2 ? (r.val || (r.res && r.res.indexOf('ใช้งานได้') > -1 ? '✓' : '-')) : '-');
    var w3 = weekVals[3] !== undefined ? weekVals[3] : (activeWk === 3 ? (r.val || (r.res && r.res.indexOf('ใช้งานได้') > -1 ? '✓' : '-')) : '-');
    var w4 = weekVals[4] !== undefined ? weekVals[4] : (activeWk === 4 ? (r.val || (r.res && r.res.indexOf('ใช้งานได้') > -1 ? '✓' : '-')) : '-');
    var w5 = weekVals[5] !== undefined ? weekVals[5] : (activeWk === 5 ? (r.val || (r.res && r.res.indexOf('ใช้งานได้') > -1 ? '✓' : '-')) : '-');

    out.push([
      r.name || '-',
      r.qty || '1',
      w1, w2, w3, w4, w5,
      r.exp || '-'
    ]);
  }

  var startRow = 6;
  var body = sheet.getRange(startRow, 1, total, nCols);
  body.setNumberFormat('@');
  body.setValues(out);
  body.setFontFamily(CFG.font).setFontSize(10).setVerticalAlignment('middle');
  sheet.getRange(startRow, 1, total, 1).setHorizontalAlignment('left');
  sheet.getRange(startRow, 2, total, nCols - 1).setHorizontalAlignment('center');
  sheet.setRowHeights(startRow, total, 24);

  sheet.getRange(4, 1, 2 + total, nCols)
       .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  var signRow = startRow + total + 2;
  if (sheet.getMaxRows() < signRow + 3) {
    sheet.insertRowsAfter(sheet.getMaxRows(), 4);
  }
  sheet.getRange(signRow, 1, 1, 4).merge().setValue('ลงชื่อ .................................................... ผู้ตรวจสอบ');
  sheet.getRange(signRow + 1, 1, 1, 4).merge().setValue('(' + (who || '....................................................') + ')');
  sheet.getRange(signRow, 5, 1, 4).merge().setValue('ลงชื่อ .................................................... หัวหน้างาน');
  sheet.getRange(signRow + 1, 5, 1, 4).merge().setValue('(....................................................)');
  sheet.getRange(signRow, 1, 2, nCols)
       .setFontFamily(CFG.font).setFontSize(10.5)
       .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(false);
  return sheet;
}

function writeDrugReport_(ss, data) {
  var cat = String(data.category || 'monthly');
  var catCode = cat === 'quarterly' ? '3เดือน' : cat === 'adhoc' ? 'ครั้งคราว' : 'เดือน';
  var dateStr = String(data.date || now_());
  var m = dateStr.match(/^(\\d{4})(?:-(\\d{2}))?(?:-(\\d{2}))?/);
  var yearVal = m && m[1] ? m[1] : new Date().getFullYear().toString();
  var monthVal = m && m[2] ? m[2] : ('0' + (new Date().getMonth() + 1)).slice(-2);
  var dayVal = m && m[3] ? m[3] : ('0' + new Date().getDate()).slice(-2);
  var thaiYear = String(parseInt(yearVal, 10) + 543);
  var dateCode = dayVal + monthVal + thaiYear;
  var baseName = data.sheetName || ('คลังยา_' + catCode + '_' + dateCode);
  var sheet = getUniqueSheet_(ss, baseName);

  var drugCols = 10;
  if (sheet.getMaxColumns() < drugCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), drugCols - sheet.getMaxColumns());
  }

  try {
    sheet.setPageSetUp(SpreadsheetApp.PageSize.A4, SpreadsheetApp.Orientation.LANDSCAPE);
  } catch (e) {}

  try { sheet.setHideGridlines(false); } catch (ge) {}
  var widths = [45, 195, 65, 85, 75, 60, 75, 80, 95, 150];
  for (var c = 0; c < drugCols; c++) sheet.setColumnWidth(c + 1, widths[c]);

  var titleTh = cat === 'quarterly'
    ? 'แบบฟอร์มเบิกจ่าย ยาเบิกทุก 3 เดือน'
    : cat === 'adhoc'
    ? 'แบบฟอร์มเบิกจ่าย ยาเบิกเป็นครั้งๆ (งบประมาณ / เบิกทุกเดือน)'
    : 'แบบฟอร์มเบิกจ่าย ยาในคลังเดือน';

  cell_(sheet, 'A1:J1', titleTh, 14, true, 'center');
  sheet.setRowHeight(1, 30);

  var subMeta = 'คลินิกงานบริการผู้ป่วยในวิสัญญี  |  ประจำเดือน/ปี (ณ วันที่ ' + thaiDate_(data.date) + ')  |  ผู้ตรวจสอบ: ' + (data.who || 'ผู้ดูแลระบบ');
  cell_(sheet, 'A2:J2', subMeta, 10, false, 'center');
  sheet.setRowHeight(2, 22);

  var drugHeads = [
    'ลำดับ', 'ชนิดยา / สารน้ำ', 'คงเหลือ', 'วันที่รับ', 'จำนวนที่รับ', 'รวม', 'ยอดต่ำสุด', 'เบิกครั้งละ', 'วันหมดอายุ (Exp)', 'หมายเหตุ'
  ];
  for (var i = 0; i < drugHeads.length; i++) {
    sheet.getRange(4, i + 1).setValue(drugHeads[i]);
  }
  sheet.getRange(4, 1, 1, drugCols)
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setFontWeight('bold').setFontSize(11).setBackground('#f1f5f9');
  sheet.setRowHeight(4, 28);

  var rows = data.rows || [];
  var total = Math.max(rows.length, 12);
  var out = [];
  for (var n = 0; n < total; n++) {
    var r = rows[n];
    if (!r) {
      out.push(['', '', '', '', '', '', '', '', '', '']);
      continue;
    }
    var totalQty = (Number(r.remaining) || 0) + (Number(r.receivedQty) || 0);
    out.push([
      n + 1,
      r.name || '',
      r.remaining !== undefined ? r.remaining : '',
      r.receivedDate || '',
      r.receivedQty !== undefined ? r.receivedQty : '',
      totalQty || '',
      r.minStock !== undefined ? r.minStock : '',
      r.batchRequest || '',
      r.expDate || '',
      r.note || ''
    ]);
  }

  var bodyRange = sheet.getRange(5, 1, total, drugCols);
  bodyRange.setValues(out).setFontFamily(CFG.font).setFontSize(10.5).setVerticalAlignment('middle');
  sheet.setRowHeights(5, total, 28);

  // Column alignments
  sheet.getRange(5, 1, total, 1).setHorizontalAlignment('center');
  sheet.getRange(5, 2, total, 1).setHorizontalAlignment('left');
  sheet.getRange(5, 3, total, 7).setHorizontalAlignment('center');
  sheet.getRange(5, 10, total, 1).setHorizontalAlignment('left');

  sheet.getRange(4, 1, total + 1, drugCols)
       .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  var signRow = 5 + total + 2;
  if (sheet.getMaxRows() < signRow + 3) {
    sheet.insertRowsAfter(sheet.getMaxRows(), 4);
  }
  sheet.getRange(signRow, 2, 1, 4).merge().setValue('ลงชื่อ .................................................... ผู้ตรวจสอบ');
  sheet.getRange(signRow + 1, 2, 1, 4).merge().setValue('(' + (data.who || '....................................................') + ')');
  sheet.getRange(signRow, 7, 1, 4).merge().setValue('ลงชื่อ .................................................... หัวหน้างาน');
  sheet.getRange(signRow + 1, 7, 1, 4).merge().setValue('(....................................................)');
  sheet.getRange(signRow, 1, 2, drugCols)
       .setFontFamily(CFG.font).setFontSize(10.5)
       .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(false);

  return sheet;
}

function cell_(sheet, a1, text, size, bold, align) {
  var r = sheet.getRange(a1);
  if (a1.indexOf(':') > -1) r.merge();
  r.setValue(text).setFontSize(size).setFontWeight(bold ? 'bold' : 'normal').setHorizontalAlignment(align).setVerticalAlignment('middle');
  return r;
}

function thaiDate_(s) {
  var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s || '');
  if (!m) return s || '';
  var months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return parseInt(m[3], 10) + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + (parseInt(m[1], 10) + 543);
}

function now_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ok_(obj) {
  obj = obj || {};
  obj.status = 'success';
  return json_(obj);
}

function fail_(msg, code) {
  return json_({ status: 'error', code: code || 'error', message: msg });
}
`;
