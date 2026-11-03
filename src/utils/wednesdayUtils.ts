export interface MonthWednesdays {
  dates: Record<number, string>;
  totalWednesdays: number;
  weeks: number[];
  monthNameThai: string;
  yearBE: number;
}

export function getWednesdaysInfoForMonth(dateInput?: string | Date): MonthWednesdays {
  let refDate = new Date();
  if (dateInput) {
    if (dateInput instanceof Date) {
      if (!isNaN(dateInput.getTime())) refDate = dateInput;
    } else {
      const str = String(dateInput).trim();
      if (str && str !== '-') {
        const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})/);
        if (isoMatch) {
          let y = parseInt(isoMatch[1], 10);
          if (y > 2400) y -= 543;
          refDate = new Date(y, parseInt(isoMatch[2], 10) - 1, 1);
        } else {
          const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
          if (dmyMatch) {
            let y = parseInt(dmyMatch[3], 10);
            if (y > 2400) y -= 543;
            refDate = new Date(y, parseInt(dmyMatch[2], 10) - 1, 1);
          } else {
            const parsed = new Date(str);
            if (!isNaN(parsed.getTime())) {
              refDate = parsed;
            }
          }
        }
      }
    }
  }

  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const yearBE = year + 543;
  const shortYear = String(yearBE).slice(-2);
  const mStr = String(month + 1).padStart(2, '0');

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const monthNameThai = thaiMonths[month] || '';

  const dates: Record<number, string> = {};
  let weekIndex = 1;

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === 3) { // 3 is Wednesday
      const dStr = String(day).padStart(2, '0');
      dates[weekIndex] = `${dStr}/${mStr}/${shortYear}`;
      weekIndex++;
    }
  }

  const totalWednesdays = weekIndex - 1;
  const weeks = Array.from({ length: totalWednesdays }, (_, i) => i + 1);

  return { dates, totalWednesdays, weeks, monthNameThai, yearBE };
}

export function calculateWednesdaysForMonth(dateInput?: string): Record<number, string> {
  return getWednesdaysInfoForMonth(dateInput).dates;
}
