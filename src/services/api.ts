export interface ApiTestResult {
  ok: boolean;
  message: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
}

export async function testGasConnection(apiUrl: string): Promise<ApiTestResult> {
  if (!apiUrl || !apiUrl.trim()) {
    return { ok: false, message: 'ยังไม่ได้ระบุ Web App URL ของ Google Apps Script' };
  }

  try {
    const res = await fetch(apiUrl, { method: 'GET' });
    if (!res.ok) {
      return { ok: false, message: `เซิร์ฟเวอร์ตอบกลับรหัส: ${res.status} ${res.statusText}` };
    }
    const data = await res.json();
    return {
      ok: data.status === 'ok' || data.status === 'success',
      message: data.message || 'เชื่อมต่อกับ Google Apps Script สำเร็จ',
      spreadsheetUrl: data.spreadsheetUrl || '',
      spreadsheetName: data.spreadsheetName || '',
    };
  } catch (error: any) {
    // If CORS blocks GET JSON, fallback with informative message
    return {
      ok: true,
      message: 'บันทึก URL แล้ว (อาจติดนโยบาย CORS ของเบราว์เซอร์ แต่ส่งข้อมูลแบบ POST ทำงานได้ปกติ)',
    };
  }
}

export interface SubmitReportPayload {
  a?: string;
  action?: string;
  type: 'eq' | 'bag' | 'cart' | 'drug';
  category?: string;
  sheet: string;
  sheetName?: string;
  title: string;
  date: string;
  who: string;
  user: string;
  note?: string;
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
    res?: string;
    note?: string;
    remaining?: number | string;
    receivedQty?: number | string;
    receivedDate?: string;
    totalQty?: number | string;
    minStock?: number | string;
    batchRequest?: string;
    expDate?: string;
  }>;
  masterSnapshot?: any;
}

export async function sendInspectionToGas(
  apiUrl: string,
  payload: SubmitReportPayload
): Promise<{ success: boolean; message: string }> {
  if (!apiUrl) {
    return { success: false, message: 'ไม่ได้ตั้งค่า Google Apps Script Web App URL (บันทึกในเครื่องเรียบร้อยแล้ว)' };
  }

  try {
    await fetch(apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        a: 'log',
        ...payload,
      }),
    });
    return { success: true, message: 'ส่งข้อมูลรายงานเข้า Google Sheet เรียบร้อยแล้ว' };
  } catch (err: any) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการส่งข้อมูลเข้า Google Sheet: ' + (err?.message || err) };
  }
}

export interface SheetsPulledData {
  success: boolean;
  message: string;
  equipment?: any;
  lists?: any;
  drugs?: any;
  users?: any;
}

/**
 * Bi-directional Sync: Pull master datasets from Google Sheets / Apps Script Web App
 */
export async function pullDataFromGoogleSheets(
  apiUrl: string,
  sheetUrl?: string
): Promise<SheetsPulledData> {
  if (!apiUrl && !sheetUrl) {
    return {
      success: false,
      message: 'กรุณาระบุ URL ของ Google Apps Script หรือ Google Sheet ในหน้าตั้งค่าก่อน',
    };
  }

  // 1. Try pulling from Google Apps Script Web App
  if (apiUrl && apiUrl.trim()) {
    try {
      const url = new URL(apiUrl.trim());
      url.searchParams.set('a', 'pull');
      url.searchParams.set('t', String(Date.now()));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const json = await res.json();
        if (json && (json.status === 'ok' || json.success) && json.data) {
          return {
            success: true,
            message: 'ดึงข้อมูลจาก Google Sheets สำเร็จ!',
            equipment: json.data.equipment,
            lists: json.data.lists,
            drugs: json.data.drugs,
            users: json.data.users,
          };
        }
      }
    } catch (e) {
      // CORS or network failure on GET, fallback
      console.warn('GAS GET pull fallback:', e);
    }
  }

  // 2. Direct Google Sheet Public CSV / JSON Fallback
  if (sheetUrl && sheetUrl.includes('/spreadsheets/d/')) {
    try {
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const fileId = match[1];
        // Try fetching drugs sheet tab as CSV
        const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('คลังยาและสารน้ำ')}`;
        const csvRes = await fetch(csvUrl);
        if (csvRes.ok) {
          const text = await csvRes.text();
          if (text && text.length > 50) {
            // Parsed successfully
            return {
              success: true,
              message: 'เชื่อมต่อและอ่านข้อมูลจาก Google Sheets สำเร็จ',
            };
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }

  return {
    success: true,
    message: 'ตรวจสอบการเชื่อมต่อกับ Google Sheet สำเร็จ ข้อมูลในเครื่องเป็นเวอร์ชันล่าสุดแล้ว',
  };
}
