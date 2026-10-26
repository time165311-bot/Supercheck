export function formatRelativeActiveTime(lastStr?: string, isCurrentUser?: boolean): { label: string; isOnline: boolean } {
  if (isCurrentUser) {
    return { label: 'Online ตอนนี้', isOnline: true };
  }

  if (!lastStr) {
    return { label: 'ใช้งานล่าสุดเมื่อวานนี้', isOnline: false };
  }

  // Handle mock strings like "วันนี้ 08:30" or ISO timestamps
  if (lastStr.includes('นาที') || lastStr.includes('ชม.') || lastStr.includes('วัน')) {
    return { label: lastStr.startsWith('ใช้งานล่าสุด') ? lastStr : `ใช้งานล่าสุด ${lastStr}`, isOnline: false };
  }

  let lastDate: Date;
  if (lastStr.includes('วันนี้') || lastStr.includes('เมื่อวาน')) {
    const today = new Date();
    if (lastStr.includes('เมื่อวาน')) {
      today.setDate(today.getDate() - 1);
    }
    lastDate = today;
  } else {
    lastDate = new Date(lastStr);
  }

  if (isNaN(lastDate.getTime())) {
    return { label: `ใช้งานล่าสุด ${lastStr}`, isOnline: false };
  }

  const diffMs = Date.now() - lastDate.getTime();
  if (diffMs < 0) {
    return { label: 'Online ตอนนี้', isOnline: true };
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Consider active if within 5 minutes
  if (diffMins < 5) {
    return { label: 'Online ตอนนี้', isOnline: true };
  } else if (diffMins < 60) {
    return { label: `ใช้งานล่าสุด ${diffMins} นาทีที่แล้ว`, isOnline: false };
  } else if (diffHours < 24) {
    return { label: `ใช้งานล่าสุด ${diffHours} ชม. ที่แล้ว`, isOnline: false };
  } else {
    return { label: `ใช้งานล่าสุด ${Math.max(diffDays, 1)} วันที่แล้ว`, isOnline: false };
  }
}
