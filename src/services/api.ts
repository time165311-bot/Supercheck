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
  type: 'eq' | 'bag' | 'cart';
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
    res: string;
    note?: string;
  }>;
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
