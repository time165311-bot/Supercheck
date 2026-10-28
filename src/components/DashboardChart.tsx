import React, { useState, useEffect } from 'react';
import { DrugItem, EquipmentItem, ListConfig, CheckItemState } from '../types';

interface DashboardChartProps {
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<'bag' | 'cart', ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  overallStats: {
    grandTotal: number;
    grandChecked: number;
    grandNormal: number;
    grandDefective: number;
    completionPct: number;
  };
}

export const DashboardChart: React.FC<DashboardChartProps> = ({
  overallStats,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const normalPct = overallStats.grandTotal > 0
    ? Math.round((overallStats.grandNormal / overallStats.grandTotal) * 100)
    : 0;
  const defectivePct = overallStats.grandTotal > 0
    ? Math.round((overallStats.grandDefective / overallStats.grandTotal) * 100)
    : 0;
  const pendingCount = Math.max(0, overallStats.grandTotal - overallStats.grandChecked);
  
  // Minimal sleek donut calculations
  const strokeWidth = 4;
  const radius = 15.9155;
  
  // Calculate relative segments
  const normalSegment = (overallStats.grandNormal / overallStats.grandTotal) * 100;
  const defectiveSegment = (overallStats.grandDefective / overallStats.grandTotal) * 100;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/60">
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-sm text-slate-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          สถิติความพร้อมประจำวัน
        </h2>
        <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-full">
          Real-time
        </span>
      </div>

      <div className="flex items-center justify-around py-2">
        {/* SVG Clean Donut */}
        <div className="relative w-28 h-28 flex items-center justify-center filter drop-shadow-md">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r={radius}
              className="text-slate-100"
              strokeWidth={strokeWidth}
              stroke="currentColor"
              fill="none"
            />
            {/* Green: Normal */}
            <circle
              cx="18"
              cy="18"
              r={radius}
              className="text-emerald-500 transition-all duration-1000 ease-out"
              strokeDasharray={`${isLoaded ? normalSegment : 0}, 100`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
            />
            {/* Red: Defective */}
            {defectiveSegment > 0 && (
              <circle
                cx="18"
                cy="18"
                r={radius}
                className="text-rose-500 transition-all duration-1000 ease-out"
                strokeDasharray={`${isLoaded ? defectiveSegment : 0}, 100`}
                strokeDashoffset={isLoaded ? `-${normalSegment}` : 0}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
              />
            )}
          </svg>
          <div className="absolute text-center">
            <span style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 900 }} className="text-xl text-slate-800 block leading-none">
              {overallStats.completionPct}%
            </span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-[9px] text-slate-400 font-semibold">
              ตรวจแล้ว
            </span>
          </div>
        </div>

        {/* Minimal Summary List */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 bg-emerald-50/60 px-3 py-1.5 rounded-xl border border-emerald-100/50">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400"></span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs font-semibold text-slate-700">ปกติพร้อมใช้</span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs font-extrabold text-emerald-600 ml-auto">{overallStats.grandNormal}</span>
          </div>
          <div className="flex items-center gap-2.5 bg-rose-50/60 px-3 py-1.5 rounded-xl border border-rose-100/50">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-400"></span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs font-semibold text-slate-700">ต้องตรวจสอบ</span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs font-extrabold text-rose-600 ml-auto">{overallStats.grandDefective}</span>
          </div>
          <div className="flex items-center gap-2.5 bg-slate-100/60 px-3 py-1.5 rounded-xl border border-slate-200/50">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs font-semibold text-slate-700">รอตรวจเช็ก</span>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs font-extrabold text-slate-600 ml-auto">{pendingCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
