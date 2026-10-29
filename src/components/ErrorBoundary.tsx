import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndRecover = () => {
    try {
      // Clear corrupt sessions or bad custom lists while keeping basic settings
      localStorage.removeItem('anesthesia_custom_lists');
      localStorage.removeItem('anesthesia_eq');
      localStorage.removeItem('anesthesia_global_checks');
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#18191a] text-[#1C1E21] dark:text-[#E4E6EB] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#242526] rounded-2xl shadow-xl border border-[#E4E6EB] dark:border-[#3A3B3C] p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold mb-1 text-[#050505] dark:text-white">
              ขออภัย เกิดข้อผิดพลาดในการแสดงผล
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              ระบบตรวจเช็คอุปกรณ์วิสัญญี (Anesthesia Care) กำลังฟื้นฟูข้อมูล
            </p>

            {this.state.error && (
              <div className="mb-5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-left overflow-x-auto text-[11px] font-mono text-red-600 dark:text-red-400 max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>รีโหลดหน้าเว็บ (Reload Page)</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAndRecover}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>รีเซ็ตข้อมูลแคชเริ่มต้น (Reset Master Data)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
