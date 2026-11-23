import { useState } from 'react';
import { CheckItemState, DrugItem, EquipmentItem, ListConfig } from '../types';
import { getWeekOfMonth } from '../utils/wednesdayUtils';

export interface ScannedItemResult {
  code: string;
  found: boolean;
  type?: 'drug' | 'equipment' | 'bag' | 'cart';
  item?: any;
  roomId?: string;
  groupName?: string;
  itemKey?: string;
}

export interface UseScannerParams {
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<'bag' | 'cart', ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  onDrugsChange: (nextDrugs: DrugItem[]) => void;
  onToggleCheck: (
    categoryOrRoomId: string,
    itemKey: string,
    result: 'ปกติ' | 'ผิดปกติ',
    itemName: string,
    week?: number,
    isMassAction?: boolean,
    customValue?: string
  ) => void;
}

export function useScanner(params: UseScannerParams) {
  const { drugs, equipment, lists, globalChecks, onDrugsChange, onToggleCheck } = params;

  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [scannedItemResult, setScannedItemResult] = useState<ScannedItemResult | null>(null);
  const [scannedDrugQty, setScannedDrugQty] = useState<number>(0);
  const [scannedCheckResult, setScannedCheckResult] = useState<'ปกติ' | 'ผิดปกติ'>('ปกติ');
  const [scannedNote, setScannedNote] = useState<string>('');

  const handleScanSuccess = (decodedText: string) => {
    setIsBarcodeScannerOpen(false);
    const cleanCode = decodedText.trim().toLowerCase();

    // 1. Search in Drugs Inventory (supports Barcode, TMT code, Hospital code, ID, Name)
    const foundDrug = drugs.find(
      (d) =>
        (d.barcode && d.barcode.trim().toLowerCase() === cleanCode) ||
        (d.tmtCode && d.tmtCode.trim().toLowerCase() === cleanCode) ||
        (d.hospitalDrugCode && d.hospitalDrugCode.trim().toLowerCase() === cleanCode) ||
        (d.id && d.id.trim().toLowerCase() === cleanCode) ||
        (d.name && d.name.trim().toLowerCase() === cleanCode)
    );

    if (foundDrug) {
      setScannedDrugQty(foundDrug.remaining ?? foundDrug.totalQty ?? 0);
      setScannedItemResult({
        code: decodedText,
        found: true,
        type: 'drug',
        item: foundDrug,
      });
      return;
    }

    // 2. Search in Room Equipment
    for (const [roomId, roomItems] of Object.entries(equipment)) {
      const foundEq = (roomItems || []).find(
        (eq) =>
          (eq.barcode && eq.barcode.trim().toLowerCase() === cleanCode) ||
          (eq.serialNumber && eq.serialNumber.trim().toLowerCase() === cleanCode) ||
          (eq.code && eq.code.trim().toLowerCase() === cleanCode) ||
          (eq.id && eq.id.trim().toLowerCase() === cleanCode) ||
          (eq.name && eq.name.trim().toLowerCase() === cleanCode)
      );
      if (foundEq) {
        const existingCheck = (globalChecks[roomId] || {})[foundEq.id || ''] || {};
        setScannedCheckResult((existingCheck.result as any) || 'ปกติ');
        setScannedNote(existingCheck.note || '');
        setScannedItemResult({
          code: decodedText,
          found: true,
          type: 'equipment',
          item: foundEq,
          roomId,
          itemKey: foundEq.id,
        });
        return;
      }
    }

    // 3. Search in Bag & Cart Lists
    for (const cat of ['bag', 'cart'] as const) {
      const groups = (lists as any)[cat]?.groups || {};
      for (const [groupName, groupItems] of Object.entries(groups)) {
        const foundIt = ((groupItems || []) as EquipmentItem[]).find(
          (it) =>
            (it.barcode && it.barcode.trim().toLowerCase() === cleanCode) ||
            (it.serialNumber && it.serialNumber.trim().toLowerCase() === cleanCode) ||
            (it.code && it.code.trim().toLowerCase() === cleanCode) ||
            (it.id && it.id.trim().toLowerCase() === cleanCode) ||
            (it.name && it.name.trim().toLowerCase() === cleanCode)
        );
        if (foundIt) {
          const itemKey = foundIt.id || `${cat}_${groupName}_${foundIt.name}`;
          const existingCheck = (globalChecks[cat] || {})[itemKey] || {};
          setScannedCheckResult((existingCheck.result as any) || 'ปกติ');
          setScannedNote(existingCheck.note || '');
          setScannedItemResult({
            code: decodedText,
            found: true,
            type: cat,
            item: foundIt,
            groupName,
            itemKey,
          });
          return;
        }
      }
    }

    // 4. Not Found
    setScannedItemResult({
      code: decodedText,
      found: false,
    });
  };

  const handleSaveScannedDrug = () => {
    if (!scannedItemResult || scannedItemResult.type !== 'drug') return;
    const drugId = scannedItemResult.item.id;
    const nextDrugs = drugs.map((d) =>
      d.id === drugId
        ? { ...d, remaining: Math.max(0, scannedDrugQty), totalQty: Math.max(0, scannedDrugQty) }
        : d
    );
    onDrugsChange(nextDrugs);
    setScannedItemResult(null);
  };

  const handleSaveScannedCheck = () => {
    if (!scannedItemResult) return;
    if (scannedItemResult.type === 'equipment' && scannedItemResult.roomId && scannedItemResult.itemKey) {
      onToggleCheck(
        scannedItemResult.roomId,
        scannedItemResult.itemKey,
        scannedCheckResult,
        scannedItemResult.item.name,
        undefined,
        false,
        scannedNote
      );
    } else if ((scannedItemResult.type === 'bag' || scannedItemResult.type === 'cart') && scannedItemResult.itemKey) {
      const curWeek = getWeekOfMonth(new Date());
      onToggleCheck(
        scannedItemResult.type,
        scannedItemResult.itemKey,
        scannedCheckResult,
        scannedItemResult.item.name,
        curWeek,
        false,
        scannedNote
      );
    }
    setScannedItemResult(null);
  };

  return {
    isBarcodeScannerOpen,
    setIsBarcodeScannerOpen,
    scannedItemResult,
    setScannedItemResult,
    scannedDrugQty,
    setScannedDrugQty,
    scannedCheckResult,
    setScannedCheckResult,
    scannedNote,
    setScannedNote,
    handleScanSuccess,
    handleSaveScannedDrug,
    handleSaveScannedCheck,
  };
}
