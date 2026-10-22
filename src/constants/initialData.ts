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
   1. โหมดฟอร์มพิมพ์ A4 อัตโนมัติ (แยกแท็บชีตตามรอบตรวจ พร้อมพิมพ์ A4 ทันที)
   2. ชีต "Audit Log": บันทึกประวัติการล็อกอินและการกระทำ
   3. เมนูระบบค้นหาชีตรอบตรวจอัจฉริยะ (Quick Jump) มุ่งตรงไปยังชีตทันที
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
    if (act === 'export_pdf') return doExportPdf_(data);

    switch (act) {
      case 'export_pdf':
        return doExportPdf_(data);
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
        if (data.items && Array.isArray(data.items)) {
          return doExportPdf_(data);
        }
        return doLog_(ss, data);
    }
  } catch (err) {
    return fail_(String(err));
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ----------------- ส่งออก PDF A4 Landscape ผ่าน Google Drive -----------------
function doExportPdf_(data) {
  try {
    var items = data.items || [];
    var surveyDate = data.surveyDate || '21 ตุลาคม 2569';
    var locationName = data.locationName || 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)';

    var tempSs = SpreadsheetApp.create('Temp_PDF_Export_' + new Date().getTime());
    var sheet = tempSs.getActiveSheet();
    sheet.setGridlines(true);

    var colWidths = [40, 110, 110, 200, 160, 90, 80, 50, 50, 90, 70, 110];
    for (var i = 0; i < colWidths.length; i++) {
      sheet.setColumnWidth(i + 1, colWidths[i]);
    }

    sheet.getRange('A1:L1').merge().setValue('ทะเบียนรายการครุภัณฑ์และอุปกรณ์').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange('A2:L2').merge().setValue('ณ วันที่ ' + surveyDate).setFontSize(12).setHorizontalAlignment('center');
    sheet.getRange('A3:F3').merge().setValue(locationName).setFontSize(11).setFontWeight('bold');
    sheet.getRange('G3:L3').merge().setValue('วัน, เดือน, ปี ที่สำรวจ: ' + surveyDate).setFontSize(11).setHorizontalAlignment('right');

    sheet.getRange('A4:A5').merge().setValue('ลำดับที่');
    sheet.getRange('B4:B5').merge().setValue('หมายเลขพัสดุ');
    sheet.getRange('C4:C5').merge().setValue('รหัสสินทรัพย์ SAP');
    sheet.getRange('D4:D5').merge().setValue('รายการ');
    sheet.getRange('E4:E5').merge().setValue('มาตรฐานและคุณลักษณะเฉพาะ');
    sheet.getRange('F4:F5').merge().setValue('แหล่งเงินที่มา (ประเภทเงินงบประมาณ)');
    sheet.getRange('G4:G5').merge().setValue('ว/ด/ป ที่ได้มา');
    sheet.getRange('H4:H5').merge().setValue('จำนวนตามบัญชี');
    sheet.getRange('I4:I5').merge().setValue('อัตราภาษี (%)');
    sheet.getRange('J4:J5').merge().setValue('ราคา (รวมภาษี)');
    sheet.getRange('K4:K5').merge().setValue('สถานที่ตั้ง ตึก / ชั้น / ห้อง');
    sheet.getRange('L4:L4').setValue('ผลการตรวจสอบพัสดุ');

    var headerRange = sheet.getRange('A4:L5');
    headerRange.setBackground('#F1F5F9')
               .setFontWeight('bold')
               .setHorizontalAlignment('center')
               .setVerticalAlignment('middle')
               .setBorder(true, true, true, true, true, true);

    if (items.length > 0) {
      var rowData = [];
      for (var j = 0; j < items.length; j++) {
        var itm = items[j];
        rowData.push([
          j + 1,
          "'" + (itm.assetNo || itm.id || ''),
          "'" + (itm.sapNo || itm.sap_id || ''),
          itm.name || itm.item_name || '',
          itm.spec || itm.specification || '',
          itm.source || itm.budget_source || '',
          itm.aquiredDate || itm.acquired_date || '',
          itm.amount || 1,
          itm.rate || 7,
          itm.price || 0,
          itm.location || itm.room_name || '',
          itm.status === 'normal' || itm.checked ? '✓' : ''
        ]);
      }

      var dataRange = sheet.getRange(6, 1, rowData.length, 12);
      dataRange.setValues(rowData);
      dataRange.setBorder(true, true, true, true, true, true);
      dataRange.setFontSize(10);

      sheet.getRange(6, 1, rowData.length, 1).setHorizontalAlignment('center');
      sheet.getRange(6, 6, rowData.length, 4).setHorizontalAlignment('center');
      sheet.getRange(6, 10, rowData.length, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('right');
      sheet.getRange(6, 11, rowData.length, 2).setHorizontalAlignment('center');
    }

    sheet.setFrozenRows(5);
    SpreadsheetApp.flush();

    var ssId = tempSs.getId();
    var sheetId = sheet.getSheetId();
    var pdfUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?' +
      'exportFormat=pdf' +
      '&format=pdf' +
      '&size=A4' +
      '&portrait=false' +
      '&fitw=true' +
      '&gridlines=true' +
      '&printtitle=true' +
      '&fzr=true' +
      '&gid=' + sheetId;

    var response = UrlFetchApp.fetch(pdfUrl, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }
    });

    var pdfBlob = response.getBlob().setName('รายงาน_ครุภัณฑ์_' + surveyDate.replace(/\\s+/g, '_') + '.pdf');
    var file = DriveApp.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    DriveApp.getFileById(ssId).setTrashed(true);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      downloadUrl: file.getDownloadUrl(),
      directUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
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
  } else {
    writeReport_(ss, d);
  }
  return ok_({ count: rows.length });
}

// เมนูลัดและฟังก์ชันค้นหาชีตด่วน & พิมพ์ใน Google Sheets
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏥 ระบบงานวิสัญญี')
      .addItem('🔍 ค้นหาชีตรอบตรวจ (Quick Jump)', 'showSheetSearchDialog')
      .addItem('🖨️ ตั้งค่าพิมพ์ฟอร์ม A4 แนวนอน (Page Setup)', 'setupActiveSheetA4Landscape')
      .addToUi();
  } catch (e) {}
}

// ระบบค้นหาชีตอัจฉริยะใน Google Sheets ค้นหาปุ๊บมุ่งตรงไปชีตนั้นทันที
function getSheetsListForDialog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return [];
  var sheets = ss.getSheets();
  var sheetList = [];

  for (var i = 0; i < sheets.length; i++) {
    try {
      var sh = sheets[i];
      var sName = sh.getName();
      // Skip hidden technical sheets
      if (sName === SHEET_USERS || sName === SHEET_AUDIT) continue;

      var sType = 'eq';
      var icon = '🏥';
      var catLabel = 'ครุภัณฑ์';

      if (sName.indexOf('กระเป๋า') > -1 || sName.indexOf('Bag') > -1) {
        sType = 'bag';
        icon = '💼';
        catLabel = 'กระเป๋า Emer';
      } else if (sName.indexOf('รถ') > -1 || sName.indexOf('Cart') > -1) {
        sType = 'cart';
        icon = '🛒';
        catLabel = 'รถ Emer';
      } else if (sName.indexOf('ยา') > -1 || sName.indexOf('คลัง') > -1 || sName.indexOf('Drug') > -1) {
        sType = 'drug';
        icon = '💊';
        catLabel = 'คลังยาและสารน้ำ';
      } else if (sName.indexOf('ฟอร์ม') > -1 || sName.indexOf('Print') > -1) {
        sType = 'print';
        icon = '📋';
        catLabel = 'แบบฟอร์มพิมพ์';
      } else {
        sType = 'other';
        icon = '📄';
        catLabel = 'แผ่นงานทั่วไป';
      }

      var rowCount = 0;
      var colCount = 0;
      try { rowCount = sh.getLastRow(); } catch(e) {}
      try { colCount = sh.getLastColumn(); } catch(e) {}

      sheetList.push({
        name: sName,
        type: sType,
        icon: icon,
        catLabel: catLabel,
        rows: rowCount,
        cols: colCount
      });
    } catch(err) {}
  }
  return sheetList;
}

function showSheetSearchDialog() {
  var sheetList = [];
  try {
    sheetList = getSheetsListForDialog();
  } catch(e) {}
  var sheetsJson = JSON.stringify(sheetList);

  var html = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8">',
    '<style>',
    '  body { font-family: -apple-system, BlinkMacSystemFont, "Sarabun", sans-serif; padding: 14px; margin: 0; background: #f8fafc; color: #0f172a; }',
    '  .header-box { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }',
    '  h3 { margin: 0; color: #2563eb; font-size: 15px; font-weight: bold; display: flex; align-items: center; gap: 6px; }',
    '  .refresh-btn { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }',
    '  .refresh-btn:hover { background: #dbeafe; }',
    '  .search-box { position: relative; margin-bottom: 10px; }',
    '  input[type="text"] { width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; border-radius: 10px; border: 1.5px solid #cbd5e1; background: #fff; outline: none; }',
    '  input[type="text"]:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }',
    '  .cat-bar { display: flex; gap: 4px; margin-bottom: 10px; overflow-x: auto; padding-bottom: 4px; }',
    '  .cat-btn { padding: 5px 10px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; }',
    '  .cat-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; }',
    '  .status-text { font-size: 11px; color: #64748b; margin-bottom: 6px; }',
    '  .sheet-list { max-height: 270px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }',
    '  .sheet-card { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all .15s; }',
    '  .sheet-card:hover { border-color: #2563eb; background: #f0f7ff; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }',
    '  .sheet-title { font-size: 12px; font-weight: bold; color: #1e293b; display: flex; align-items: center; gap: 6px; }',
    '  .sheet-meta { font-size: 10px; color: #64748b; margin-top: 2px; }',
    '  .jump-badge { font-size: 11px; font-weight: 700; color: #2563eb; background: #dbeafe; padding: 4px 10px; border-radius: 8px; shrink: 0; }',
    '</style></head><body>',
    '<div class="header-box">',
    '  <h3>🔍 ค้นหาชีตรอบตรวจ (Quick Jump)</h3>',
    '  <button type="button" class="refresh-btn" onclick="fetchSheets()">🔄 รีเฟรช</button>',
    '</div>',
    '<div class="search-box">',
    '  <input type="text" id="searchInput" placeholder="พิมพ์ชื่อชีต, วันที่, หรือคำที่ต้องการค้นหา...">',
    '</div>',
    '<div class="cat-bar">',
    '  <button type="button" class="cat-btn active" data-cat="all">🌟 ทั้งหมด</button>',
    '  <button type="button" class="cat-btn" data-cat="drug">💊 คลังยา</button>',
    '  <button type="button" class="cat-btn" data-cat="eq">🏥 ครุภัณฑ์</button>',
    '  <button type="button" class="cat-btn" data-cat="bag">💼 กระเป๋า</button>',
    '  <button type="button" class="cat-btn" data-cat="cart">🛒 รถ</button>',
    '</div>',
    '<div class="status-text" id="statusCount"></div>',
    '<div class="sheet-list" id="sheetContainer"></div>',
    '<script>',
    'var allSheets = ' + sheetsJson + ';',
    'var currentCat = "all";',
    'function renderSheets() {',
    '  var q = (document.getElementById("searchInput").value || "").toLowerCase().trim();',
    '  var container = document.getElementById("sheetContainer");',
    '  container.innerHTML = "";',
    '  var matched = allSheets.filter(function(s) {',
    '    if (!s) return false;',
    '    var catOk = currentCat === "all" || s.type === currentCat;',
    '    var sName = String(s.name || "").toLowerCase();',
    '    var sCat = String(s.catLabel || "").toLowerCase();',
    '    var textOk = !q || sName.indexOf(q) > -1 || sCat.indexOf(q) > -1;',
    '    return catOk && textOk;',
    '  });',
    '  var statusEl = document.getElementById("statusCount");',
    '  if (statusEl) statusEl.textContent = "พบ " + matched.length + " ชีต (จากทั้งหมด " + allSheets.length + " ชีต)";',
    '  if (matched.length === 0) {',
    '    var empty = document.createElement("div");',
    '    empty.style.textAlign = "center";',
    '    empty.style.padding = "24px";',
    '    empty.style.color = "#94a3b8";',
    '    empty.style.fontSize = "12px";',
    '    empty.textContent = allSheets.length === 0 ? "กำลังค้นหาชีต หรือยังไม่มีชีตในสเปรดชีตนี้..." : "ไม่พบชีตที่ตรงกับคำค้นหา";',
    '    container.appendChild(empty);',
    '    return;',
    '  }',
    '  matched.forEach(function(s) {',
    '    var card = document.createElement("div");',
    '    card.className = "sheet-card";',
    '    card.onclick = function() { jumpTo(s.name); };',
    '    var info = document.createElement("div");',
    '    var title = document.createElement("div");',
    '    title.className = "sheet-title";',
    '    title.textContent = (s.icon || "📄") + " " + s.name;',
    '    var meta = document.createElement("div");',
    '    meta.className = "sheet-meta";',
    '    meta.textContent = "หมวด: " + (s.catLabel || "-") + " • " + (s.rows || 0) + " แถว";',
    '    info.appendChild(title);',
    '    info.appendChild(meta);',
    '    var badge = document.createElement("span");',
    '    badge.className = "jump-badge";',
    '    badge.textContent = "ไปที่ชีตนี้ ➜";',
    '    card.appendChild(info);',
    '    card.appendChild(badge);',
    '    container.appendChild(card);',
    '  });',
    '}',
    'function jumpTo(sheetName) {',
    '  if (!sheetName) return;',
    '  google.script.run',
    '    .withSuccessHandler(function() {',
    '      google.script.host.close();',
    '    })',
    '    .withFailureHandler(function(err) {',
    '      alert("ไม่สามารถเปิดชีตได้: " + (err.message || err));',
    '    })',
    '    .jumpToSheetByName(sheetName);',
    '}',
    'function fetchSheets() {',
    '  var statusEl = document.getElementById("statusCount");',
    '  if (statusEl) statusEl.textContent = "กำลังโหลดรายชื่อชีต...";',
    '  google.script.run',
    '    .withSuccessHandler(function(list) {',
    '      if (list && Array.isArray(list)) {',
    '        allSheets = list;',
    '        renderSheets();',
    '      }',
    '    })',
    '    .getSheetsListForDialog();',
    '}',
    'var catButtons = document.querySelectorAll(".cat-btn");',
    'for (var b = 0; b < catButtons.length; b++) {',
    '  catButtons[b].onclick = function() {',
    '    for (var j = 0; j < catButtons.length; j++) { catButtons[j].classList.remove("active"); }',
    '    this.classList.add("active");',
    '    currentCat = this.getAttribute("data-cat");',
    '    renderSheets();',
    '  };',
    '}',
    'document.getElementById("searchInput").oninput = renderSheets;',
    'renderSheets();',
    '// Also fetch dynamically to ensure live sheets are fully up to date',
    'fetchSheets();',
    'setTimeout(function() { document.getElementById("searchInput").focus(); }, 150);',
    '</script></body></html>'
  ].join('\\n');

  var output = HtmlService.createHtmlOutput(html).setWidth(520).setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(output, 'ระบบค้นหาชีตอัจฉริยะ (Quick Jump)');
}

function jumpToSheetByName(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return false;
  var sh = ss.getSheetByName(sheetName);
  if (sh) {
    ss.setActiveSheet(sh);
    try {
      SpreadsheetApp.setActiveSheet(sh);
    } catch(e) {}
    try {
      ss.toast('มุ่งตรงไปยังชีต "' + sheetName + '" เรียบร้อยแล้ว', 'ค้นหาด่วน', 2);
    } catch(e) {}
    return true;
  }
  return false;
}

// ฟังก์ชันตั้งค่าหน้ากระดาษ A4 แนวนอน พร้อมพิมพ์ Ctrl+P ได้ทันที
function setupActiveSheetA4Landscape() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getActiveSheet();
  if (!sh) return;
  try {
    sh.setPageSetUp(SpreadsheetApp.PageSize.A4, SpreadsheetApp.Orientation.LANDSCAPE);
    sh.setHiddenGridlines(true);
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

function writeDrugReport_(ss, data) {
  var cat = String(data.category || 'monthly');
  var baseName = data.sheetName || ('คลังยา_' + (cat === 'quarterly' ? 'เบิก3เดือน' : cat === 'adhoc' ? 'เบิกครั้งๆ' : 'คลังเดือน') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmm'));
  var sheet = getUniqueSheet_(ss, baseName);

  var drugCols = 10;
  if (sheet.getMaxColumns() < drugCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), drugCols - sheet.getMaxColumns());
  }

  try {
    sheet.setPageSetUp(SpreadsheetApp.PageSize.A4, SpreadsheetApp.Orientation.LANDSCAPE);
  } catch (e) {}

  sheet.setHiddenGridlines(true);
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
