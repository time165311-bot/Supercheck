import { ListConfig, RoomDef } from '../types';

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

export const DEFAULT_LISTS: Record<'bag' | 'cart', ListConfig> = {
  bag: {
    title: 'เช็คกระเป๋าอีเมอร์เจนซี่',
    sheet: 'กระเป๋า Emergency',
    groups: {
      'ทางเดินหายใจ (Airway)': [
        {
          name: 'Laryngoscope Handle + Blades (ไฟสว่างชัดเจน)',
          code: 'EM-BAG-001',
          sap: '432028000501',
          spec: 'ด้ามจับพร้อมใบมีดเบอร์ 2, 3, 4 แสงไฟสว่าง',
          source: 'เงินบำรุงโรงพยาบาล',
          date: '10 ม.ค. 68',
          qty: '1',
          price: '8,500.00',
          no: '1',
          exp: getSampleExpDate(120),
          img: '',
        },
        {
          name: 'Endotracheal Tube (ETT) เบอร์ 6.5, 7.0, 7.5, 8.0',
          code: 'EM-BAG-002',
          sap: '432028000502',
          spec: 'ท่อช่วยหายใจปลอดเชื้อ ชนิดมี cuff',
          source: 'งบประมาณยาและเวชภัณฑ์',
          date: '15 ก.พ. 68',
          qty: '4',
          price: '1,200.00',
          no: '2',
          exp: getSampleExpDate(-5), // Expired sample to demonstrate alert!
          img: '',
        },
        {
          name: 'Stylet / Guide wire สำหรับใส่ท่อหายใจ',
          code: 'EM-BAG-003',
          sap: '432028000503',
          spec: 'ลวดนำทางท่อช่วยหายใจปลอดเชื้อ',
          source: 'เงินบำรุง',
          date: '10 ม.ค. 68',
          qty: '2',
          price: '450.00',
          no: '3',
          exp: getSampleExpDate(90),
          img: '',
        },
        {
          name: 'Ambu Bag พร้อม Mask ผู้ใหญ่ & สายออกซิเจน',
          code: 'EM-BAG-004',
          sap: '432028000504',
          spec: 'ลูกสูบช่วยหายใจพร้อมถุงสำรองออกซิเจน',
          source: 'เงินงบประมาณ',
          date: '5 ม.ค. 68',
          qty: '1',
          price: '3,800.00',
          no: '4',
          exp: getSampleExpDate(200),
          img: '',
        },
      ],
      'ยาช่วยชีวิตฉุกเฉิน (Emergency Drugs)': [
        {
          name: 'Adrenaline (Epinephrine) 1mg/1ml (5 หลอด)',
          code: 'MED-EM-01',
          sap: '432028000510',
          spec: 'ยาฉีดขยายหลอดลมและกระตุ้นหัวใจ',
          source: 'คลังยาโรงพยาบาล',
          date: '1 ม.ค. 68',
          qty: '5',
          price: '250.00',
          no: '5',
          exp: getSampleExpDate(18), // Near expiry sample (< 30 days)
          img: '',
        },
        {
          name: 'Atropine Sulfate 0.6mg/1ml (5 หลอด)',
          code: 'MED-EM-02',
          sap: '432028000511',
          spec: 'ยากระตุ้นอัตราการเต้นของหัวใจ',
          source: 'คลังยาโรงพยาบาล',
          date: '1 ม.ค. 68',
          qty: '5',
          price: '180.00',
          no: '6',
          exp: getSampleExpDate(150),
          img: '',
        },
        {
          name: 'Amiodarone 150mg/3ml (2 หลอด)',
          code: 'MED-EM-03',
          sap: '432028000512',
          spec: 'ยารักษาภาวะหัวใจเต้นผิดจังหวะ',
          source: 'คลังยาโรงพยาบาล',
          date: '1 ม.ค. 68',
          qty: '2',
          price: '320.00',
          no: '7',
          exp: getSampleExpDate(-12), // Expired sample!
          img: '',
        },
      ],
      'สารน้ำและอุปกรณ์ให้สารน้ำ': [
        {
          name: 'NSS 0.9% 1,000 ml (2 ถุง)',
          code: 'MED-IV-01',
          sap: '432028000520',
          spec: 'น้ำเกลือปราศจากเชื้อสำหรับฉีด',
          source: 'คลังยา',
          date: '10 ม.ค. 68',
          qty: '2',
          price: '140.00',
          no: '8',
          exp: getSampleExpDate(45),
          img: '',
        },
        {
          name: 'IV Catheter เบอร์ 18, 20, 22 อย่างละ 2 ชิ้น',
          code: 'MED-IV-02',
          sap: '432028000521',
          spec: 'เข็มแทงให้น้ำเกลือปลอดเชื้อ',
          source: 'เงินบำรุง',
          date: '10 ม.ค. 68',
          qty: '6',
          price: '180.00',
          no: '9',
          exp: getSampleExpDate(25), // Near expiry sample!
          img: '',
        },
      ],
    },
  },
  cart: {
    title: 'เช็ครถอีเมอร์เจนซี่',
    sheet: 'รถ Emergency',
    groups: {
      'เครื่องมือกู้ชีพและไฟฟ้า (Defibrillator & Monitor)': [
        {
          name: 'เครื่อง Defibrillator (ทดสอบแบตเตอรี่ & Paddle discharge test)',
          code: 'EQ-CART-001',
          sap: '432028000601',
          spec: 'เครื่องช็อกไฟฟ้าหัวใจชนิด Biphasic พร้อมแบตเตอรี่สำรอง',
          source: 'เงินงบประมาณ',
          date: '15 พ.ย. 67',
          qty: '1',
          price: '380,000.00',
          no: '1',
          exp: '',
          img: '',
        },
        {
          name: 'แผ่น Defibrillator Pads (Adult & Pediatric)',
          code: 'EQ-CART-002',
          sap: '432028000602',
          spec: 'แผ่นเจลช็อกหัวใจแบบแปะอัตโนมัติ',
          source: 'เงินบำรุง',
          date: '20 ธ.ค. 67',
          qty: '2',
          price: '4,500.00',
          no: '2',
          exp: getSampleExpDate(15), // Near expiry!
          img: '',
        },
        {
          name: 'เครื่องดูดเสมหะประจำรถ (Portable Suction) ตรวจแรงดูด',
          code: 'EQ-CART-003',
          sap: '432028000603',
          spec: 'เครื่องดูดของเหลวสุญญากาศชนิดพกพา',
          source: 'เงินงบประมาณ',
          date: '10 ธ.ค. 67',
          qty: '1',
          price: '28,000.00',
          no: '3',
          exp: '',
          img: '',
        },
      ],
      'ลิ้นชักที่ 1: ยาช่วยชีวิตฉุกเฉิน (Crash Cart Meds)': [
        {
          name: 'Adrenaline 1mg/1ml (10 หลอด)',
          code: 'MED-C1-01',
          sap: '432028000611',
          spec: 'ยาฉีดกระตุ้นหัวใจฉุกเฉิน',
          source: 'คลังยา',
          date: '5 ม.ค. 68',
          qty: '10',
          price: '500.00',
          no: '4',
          exp: getSampleExpDate(120),
          img: '',
        },
        {
          name: 'Cordarone (Amiodarone) 150mg/3ml (4 หลอด)',
          code: 'MED-C1-02',
          sap: '432028000612',
          spec: 'ยาต้านภาวะหัวใจเต้นผิดจังหวะ',
          source: 'คลังยา',
          date: '5 ม.ค. 68',
          qty: '4',
          price: '640.00',
          no: '5',
          exp: getSampleExpDate(-3), // Expired sample!
          img: '',
        },
        {
          name: 'Sodium Bicarbonate 7.5% 50ml (2 ขวด)',
          code: 'MED-C1-03',
          sap: '432028000613',
          spec: 'สารละลายปรับสมดุลกรดด่างในเลือด',
          source: 'คลังยา',
          date: '5 ม.ค. 68',
          qty: '2',
          price: '360.00',
          no: '6',
          exp: getSampleExpDate(180),
          img: '',
        },
      ],
      'ลิ้นชักที่ 2: อุปกรณ์เปิดทางเดินหายใจ (Airway Equipment)': [
        {
          name: 'ชุด Laryngoscope Handle + 4 Blades พร้อมถ่านสำรอง',
          code: 'EQ-C2-01',
          sap: '432028000621',
          spec: 'ชุดส่องกล่องเสียงสเตนเลสมาตรฐาน',
          source: 'เงินบำรุง',
          date: '10 ม.ค. 68',
          qty: '1',
          price: '9,500.00',
          no: '7',
          exp: '',
          img: '',
        },
        {
          name: 'Video Laryngoscope Blade (ถ้ามี) / Disposable Blade',
          code: 'EQ-C2-02',
          sap: '432028000622',
          spec: 'ใบมีดกล้องช่วยใส่ท่อหายใจ',
          source: 'เงินงบประมาณ',
          date: '12 ม.ค. 68',
          qty: '2',
          price: '3,200.00',
          no: '8',
          exp: getSampleExpDate(220),
          img: '',
        },
        {
          name: 'Laryngeal Mask Airway (LMA) เบอร์ 3, 4, 5',
          code: 'EQ-C2-03',
          sap: '432028000623',
          spec: 'หน้ากากครอบกล่องเสียงปลอดเชื้อ',
          source: 'เงินบำรุง',
          date: '10 ม.ค. 68',
          qty: '3',
          price: '2,700.00',
          no: '9',
          exp: getSampleExpDate(24), // Near expiry!
          img: '',
        },
      ],
      'ถังออกซิเจนและโครงสร้างตัวรถ': [
        {
          name: 'ถังออกซิเจนสำรองประจำรถ (Oxygen E-Cylinder) แรงดัน > 1000 psi',
          code: 'EQ-C3-01',
          sap: '432028000631',
          spec: 'ถังออกซิเจนการแพทย์แรงดันสูงพร้อมเกจวัด',
          source: 'เงินบำรุง',
          date: '1 ม.ค. 68',
          qty: '1',
          price: '6,500.00',
          no: '10',
          exp: '',
          img: '',
        },
        {
          name: 'ซีลล็อกรถฉุกเฉิน (Lock Seal) หมายเลขตรงตามสมุดบันทึก',
          code: 'EQ-C3-02',
          sap: '432028000632',
          spec: 'สายรัดพลาสติกล็อกรถฉุกเฉินมีรหัสกำกับ',
          source: 'พัสดุทั่วไป',
          date: '1 ม.ค. 68',
          qty: '1',
          price: '50.00',
          no: '11',
          exp: '',
          img: '',
        },
      ],
    },
  },
};

export const GAS_SCRIPT_V5 = `/* ============================================================
   ระบบตรวจเช็คอุปกรณ์วิสัญญี — Google Apps Script (Code.gs) v6
   คุณสมบัติใหม่:
   1. โหมดฟอร์มพิมพ์ A4 อัตโนมัติ (PRINT_TEMPLATE):
      - มีชีต "📋 ฟอร์มพิมพ์_A4" หน้าเดียวที่อัปเดตข้อมูลรอบตรวจล่าสุดอัตโนมัติ
      - เมื่อต้องการพิมพ์ แค่เปิดหน้านี้แล้วกด Ctrl + P ได้ทันที ออกมาพอดีหน้า A4 สวยงาม!
      - ไม่สร้างแท็บชีตรกเต็มไฟล์ แก้ปัญหาแท็บแยกเยอะเกินไป
   2. ชีต "📊 Master_รวมบันทึก": บันทึกรวมทุกรอบตามวันเวลา ไม่ต้องกลัวข้อมูลหาย
   3. ชีต "Audit Log": บันทึกประวัติการล็อกอินและการกระทำ
   4. สลับโหมดเป็นแยกแท็บได้ (ตั้งค่า WORKBOOK_MODE = 'SEPARATE_SHEETS')
   ============================================================ */

// ตั้งค่าโหมดการจัดชีต:
// 'PRINT_TEMPLATE' = แนะนำ! หน้าฟอร์มพิมพ์ A4 หน้าเดียว ไม่รกชีต สั่งพิมพ์ Ctrl+P สะดวกที่สุด
// 'SEPARATE_SHEETS' = แยกแท็บชีตใหม่ทุกรอบตรวจ
var WORKBOOK_MODE = 'PRINT_TEMPLATE';

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
var SHEET_MASTER = '📊 Master_รวมบันทึก';
var SHEET_USERS = 'Users';
var SHEET_AUDIT = 'Audit Log';
var USER_HEAD = ['Username', 'Name', 'Role', 'Active', 'Salt', 'Hash', 'MustChange', 'Created', 'LastLogin'];
var AUDIT_HEAD = ['เวลาบันทึก (Timestamp)', 'บัญชีผู้ใช้ (Username)', 'ชื่อ-นามสกุล', 'การกระทำ (Action)', 'รายละเอียด / ไอเทมที่แก้ไข', 'สถานที่ / ห้อง'];

function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return fail_('สคริปต์ไม่ได้ผูกกับ Google Sheet', 'setup');

    var act = String(data.a || data.action || '');

    if (act === 'login') return doLogin_(ss, data);
    if (act === 'audit') return doAuditLog_(ss, data);

    switch (act) {
      case 'log':
        var res = doLog_(ss, data);
        doAuditLog_(ss, {
          user: data.user || 'system',
          name: data.who || data.user || 'เจ้าหน้าที่',
          action: 'บันทึกผลการตรวจสอบ',
          details: 'ส่งรายงานตรวจเช็ค ' + (data.title || data.sheet) + ' (' + (data.rows ? data.rows.length : 0) + ' รายการ)',
          location: data.title || '-'
        });
        return res;
      default:
        return doLog_(ss, data);
    }
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
  writeReport_(ss, d);
  appendMasterAll_(ss, d, rows);
  return ok_({ count: rows.length });
}

function appendMasterAll_(ss, d, rows) {
  var sh = ss.getSheetByName(SHEET_MASTER);
  var roundId = String(d.sheetName || computeSheetName_(d) || 'รอบตรวจ_' + now_());
  if (!sh) {
    sh = ss.insertSheet(SHEET_MASTER);
    var heads = [
      'รหัสรอบตรวจ', 'วันเวลาที่บันทึก', 'วันที่ตรวจ', 'ผู้ตรวจ', 'หมวดหมู่', 'สถานที่/ห้อง',
      'ลำดับ', 'หมายเลขพัสดุ', 'รหัส SAP', 'รายการ', 'มาตรฐาน/คุณลักษณะ', 'แหล่งเงินที่มา',
      'ว/ด/ป ได้มา', 'จำนวน', 'ภาษี %', 'ราคา', 'ผลการตรวจ', 'หมายเหตุ'
    ];
    sh.appendRow(heads);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, heads.length).setFontFamily(CFG.font).setFontWeight('bold').setBackground('#f1f5f9');
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 140);
    sh.setColumnWidth(3, 100);
    sh.setColumnWidth(4, 120);
    sh.setColumnWidth(5, 110);
    sh.setColumnWidth(6, 150);
    sh.setColumnWidth(7, 45);
    sh.setColumnWidth(8, 120);
    sh.setColumnWidth(9, 100);
    sh.setColumnWidth(10, 180);
    sh.setColumnWidth(11, 140);
    sh.setColumnWidth(12, 100);
    sh.setColumnWidth(13, 90);
    sh.setColumnWidth(14, 45);
    sh.setColumnWidth(15, 45);
    sh.setColumnWidth(16, 75);
    sh.setColumnWidth(17, 95);
    sh.setColumnWidth(18, 140);
  }
  var now = now_();
  var bulk = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    bulk.push([
      roundId,
      now,
      String(d.date || ''),
      String(d.who || ''),
      String(d.type === 'eq' ? 'ครุภัณฑ์' : d.type === 'bag' ? 'กระเป๋า Emer' : 'รถ Emer'),
      String(r.location || d.title || ''),
      i + 1,
      String(r.code || '-'),
      String(r.sap || '-'),
      String(r.name || '-'),
      String(r.spec || '-'),
      String(r.source || '-'),
      String(r.date || '-'),
      String(r.qty || '1'),
      String(r.tax !== undefined && r.tax !== '' ? r.tax : '7'),
      String(r.price || '-'),
      String(r.res || '-'),
      String(r.note || '')
    ]);
  }
  if (bulk.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, bulk.length, bulk[0].length).setValues(bulk);
  }
}

// เมนูลัดและฟังก์ชันโหลดรอบตรวจเพื่อพิมพ์ใน Google Sheets
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🖨️ ระบบพิมพ์ฟอร์ม A4')
      .addItem('📋 โหลดรอบตรวจล่าสุดมาที่ฟอร์มพิมพ์', 'loadLatestToPrint')
      .addItem('🔎 โหลดรอบตรวจตามรหัสที่เลือก', 'loadSelectedRoundToPrint')
      .addToUi();
  } catch (e) {}
}

function loadLatestToPrint() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName(SHEET_MASTER);
  if (!master || master.getLastRow() < 2) return;
  var lastRound = master.getRange(master.getLastRow(), 1).getValue();
  loadRoundData(ss, lastRound);
}

function loadSelectedRoundToPrint_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName(SHEET_MASTER);
  if (!master || master.getLastRow() < 2) {
    if (!master) {
      master = ss.insertSheet(SHEET_MASTER);
    }
    var heads = [
      'รหัสรอบตรวจ', 'วันเวลาที่บันทึก', 'วันที่ตรวจ', 'ผู้ตรวจ', 'หมวดหมู่', 'สถานที่/ห้อง',
      'ลำดับ', 'หมายเลขพัสดุ', 'รหัส SAP', 'รายการ', 'มาตรฐาน/คุณลักษณะ', 'แหล่งเงินที่มา',
      'ว/ด/ป ได้มา', 'จำนวน', 'ภาษี %', 'ราคา', 'ผลการตรวจ', 'หมายเหตุ'
    ];
    master.clear();
    master.appendRow(heads);
    master.setFrozenRows(1);
    var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    master.appendRow([
      'รอบตรวจ_ตัวอย่าง_' + today,
      now_(),
      today,
      'เจ้าหน้าที่ (ตัวอย่าง)',
      'ครุภัณฑ์',
      'ห้องวิสัญญี',
      1,
      'EQ-001',
      '4320280001',
      'Laryngoscope Handle + Blades',
      'ชุดส่องกล่องเสียง',
      'เงินบำรุง',
      '2025-01-01',
      '1',
      '7',
      '5,000',
      'ใช้งานได้',
      'ปกติ'
    ]);
  }
  var data = master.getDataRange().getValues();
  var roundsList = [];
  var seenMap = {};
  for (var i = 1; i < data.length; i++) {
    var rId = String(data[i][0]).trim();
    if (rId && !seenMap[rId]) {
      seenMap[rId] = true;
      var cName = String(data[i][4] || 'ครุภัณฑ์').trim();
      var cKey = 'eq';
      if (cName.indexOf('กระเป๋า') > -1) cKey = 'bag';
      else if (cName.indexOf('รถ') > -1) cKey = 'cart';

      roundsList.push({
        id: rId,
        date: String(data[i][2] || ''),
        who: String(data[i][3] || ''),
        catName: cName,
        catKey: cKey,
        title: String(data[i][5] || '')
      });
    }
  }

  if (roundsList.length === 0) {
    SpreadsheetApp.getUi().alert('ไม่พบข้อมูลรอบตรวจใน Master sheet');
    return;
  }

  var roundsJson = JSON.stringify(roundsList);

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Sarabun", sans-serif; padding: 16px; margin: 0; background: #fafafa; color: #1f2937; }' +
    'h3 { margin: 0 0 10px 0; color: #0071e3; font-size: 15px; }' +
    '.cat-btns { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }' +
    '.cat-btn { padding: 5px 10px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }' +
    '.cat-btn.active { background: #0071e3; color: #fff; border-color: #0071e3; }' +
    '.label { font-size: 12px; font-weight: 600; color: #4b5563; margin-bottom: 6px; display: block; }' +
    'select { width: 100%; padding: 8px 10px; font-size: 13px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; margin-bottom: 16px; outline: none; }' +
    '.action-bar { display: flex; justify-content: flex-end; gap: 8px; }' +
    '#loadBtn { background: #0071e3; color: white; border: none; padding: 9px 20px; font-size: 13px; border-radius: 8px; cursor: pointer; font-weight: bold; }' +
    '#loadBtn:disabled { background: #9ca3af; cursor: not-allowed; }' +
    '#cancelBtn { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 9px 15px; font-size: 13px; border-radius: 8px; cursor: pointer; }' +
    '</style></head><body>' +
    '<h3>📋 เลือกดึงรอบตรวจเพื่อพิมพ์ A4</h3>' +
    '<div class="cat-btns">' +
    '  <button type="button" class="cat-btn active" id="btn-all" onclick="filterCat(\\'all\\', this)">🌟 ทั้งหมด</button>' +
    '  <button type="button" class="cat-btn" id="btn-eq" onclick="filterCat(\\'eq\\', this)">🏥 ครุภัณฑ์</button>' +
    '  <button type="button" class="cat-btn" id="btn-bag" onclick="filterCat(\\'bag\\', this)">💼 กระเป๋า Emer</button>' +
    '  <button type="button" class="cat-btn" id="btn-cart" onclick="filterCat(\\'cart\\', this)">🛒 รถ Emer</button>' +
    '</div>' +
    '<span class="label">เลือกรอบตรวจที่ต้องการโหลด:</span>' +
    '<select id="roundSel"></select>' +
    '<div class="action-bar">' +
    '  <button type="button" id="cancelBtn" onclick="google.script.host.close()">ยกเลิก</button>' +
    '  <button type="button" id="loadBtn" onclick="doLoad()">⚡ โหลดข้อมูลรอบนี้</button>' +
    '</div>' +
    '<script>' +
    'var allRounds = ' + roundsJson + ';' +
    'var currentCat = "all";' +
    'function renderOpts() {' +
    '  var sel = document.getElementById("roundSel");' +
    '  sel.innerHTML = "";' +
    '  var filtered = allRounds.filter(function(r){ return currentCat === "all" || r.catKey === currentCat; });' +
    '  if (filtered.length === 0) {' +
    '    var opt = document.createElement("option");' +
    '    opt.text = "-- ไม่มีรอบตรวจในหมวดนี้ --";' +
    '    opt.value = "";' +
    '    sel.appendChild(opt);' +
    '    document.getElementById("loadBtn").disabled = true;' +
    '    return;' +
    '  }' +
    '  document.getElementById("loadBtn").disabled = false;' +
    '  for (var i = filtered.length - 1; i >= 0; i--) {' +
    '    var r = filtered[i];' +
    '    var badge = r.catKey === "bag" ? "[💼 กระเป๋า]" : r.catKey === "cart" ? "[🛒 รถ]" : "[🏥 ครุภัณฑ์]";' +
    '    var opt = document.createElement("option");' +
    '    opt.value = r.id;' +
    '    opt.text = badge + " " + r.date + " - " + r.title + " (" + (r.who || "ผู้ตรวจ") + ")";' +
    '    sel.appendChild(opt);' +
    '  }' +
    '}' +
    'function filterCat(cat, el) {' +
    '  currentCat = cat;' +
    '  var btns = document.querySelectorAll(".cat-btn");' +
    '  btns.forEach(function(b){ b.classList.remove("active"); });' +
    '  el.classList.add("active");' +
    '  renderOpts();' +
    '}' +
    'function doLoad() {' +
    '  var sel = document.getElementById("roundSel");' +
    '  var val = sel.value;' +
    '  if (!val) return;' +
    '  var btn = document.getElementById("loadBtn");' +
    '  btn.disabled = true;' +
    '  btn.innerText = "⏳ กำลังดึงข้อมูลฟอร์ม A4...";' +
    '  google.script.run.withSuccessHandler(function(){' +
    '    google.script.host.close();' +
    '  }).withFailureHandler(function(err){' +
    '    alert("เกิดข้อผิดพลาด: " + err.message);' +
    '    btn.disabled = false;' +
    '    btn.innerText = "⚡ โหลดข้อมูลรอบนี้";' +
    '  }).loadRoundData_(val);' +
    '}' +
    'renderOpts();' +
    '</script></body></html>';

  var output = HtmlService.createHtmlOutput(html).setWidth(520).setHeight(270);
  SpreadsheetApp.getUi().showModalDialog(output, 'เลือกดึงรอบตรวจเพื่อพิมพ์ A4');
}

function loadRoundData_(ssOrId, optRoundId) {
  var ss, roundId;
  if (typeof optRoundId === 'undefined') {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    roundId = ssOrId;
  } else {
    ss = ssOrId;
    roundId = optRoundId;
  }
  var master = ss.getSheetByName(SHEET_MASTER);
  if (!master) return false;
  var data = master.getDataRange().getValues();
  var matched = [];
  var roundMeta = { date: '', who: '', type: 'eq', title: '' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(roundId).trim()) {
      roundMeta.date = data[i][2];
      roundMeta.who = data[i][3];
      roundMeta.type = data[i][4] || 'ครุภัณฑ์';
      roundMeta.title = data[i][5];
      matched.push({
        code: data[i][7],
        sap: data[i][8],
        name: data[i][9],
        spec: data[i][10],
        source: data[i][11],
        date: data[i][12],
        qty: data[i][13],
        tax: data[i][14],
        price: data[i][15],
        res: data[i][16],
        note: data[i][17],
        location: data[i][5]
      });
    }
  }
  if (matched.length > 0) {
    var docTitle = roundMeta.title;
    if (!docTitle) {
      if (roundMeta.type.indexOf('กระเป๋า') > -1) docTitle = 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency';
      else if (roundMeta.type.indexOf('รถ') > -1) docTitle = 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';
      else docTitle = 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)';
    }

    var printSheet = writeReport_(ss, {
      title: docTitle,
      type: roundMeta.type,
      date: roundMeta.date,
      who: roundMeta.who,
      sheetName: roundId,
      rows: matched
    });
    if (printSheet) {
      ss.setActiveSheet(printSheet);
    } else {
      var fallback = ss.getSheetByName(SHEET_PRINT);
      if (fallback) ss.setActiveSheet(fallback);
    }
    SpreadsheetApp.flush();
    try {
      ss.toast('ดึงข้อมูลรอบตรวจลงฟอร์มพิมพ์ A4 สำเร็จแล้ว', 'สำเร็จ', 3);
    } catch(te){}
    return true;
  }
  return false;
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

  if (typeKey === 'bag') {
    return 'กระเป๋าEmer_' + thaiYear + '_' + monthVal;
  } else if (typeKey === 'cart') {
    return 'รถEmer_' + thaiYear + '_' + monthVal;
  } else {
    return 'ครุภัณฑ์_' + thaiYear + '_' + dayVal + monthVal;
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
  sheet.setHiddenGridlines(true);
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
