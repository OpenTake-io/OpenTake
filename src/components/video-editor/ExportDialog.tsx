import { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExportProgress } from '@/lib/exporter';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ExportProgress | null;
  isExporting: boolean;
  error: string | null;
  onCancel?: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ExportDialog({
  isOpen,
  onClose,
  progress,
  isExporting,
  error,
  onCancel,
}: ExportDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isExporting && progress && progress.percentage >= 100 && !error) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isExporting, progress, error, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={isExporting ? undefined : onClose}
      />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-[#23232a] rounded-2xl shadow-2xl border border-[#34B27B] p-8 w-[90vw] max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {showSuccess ? (
              <>
                <div className="w-10 h-10 rounded-full bg-[#34B27B] flex items-center justify-center">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-200">Export Complete!</span>
              </>
            ) : (
              <>
                {isExporting ? (
                  <Loader2 className="w-6 h-6 text-[#34B27B] animate-spin" />
                ) : (
                  <Download className="w-6 h-6 text-[#34B27B]" />
                )}
                <span className="text-xl font-bold text-slate-200">
                  {error ? 'Export Failed' : isExporting ? 'Exporting Video' : 'Export Video'}
                </span>
              </>
            )}
          </div>
          {!isExporting && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-[#34B27B]/20 text-slate-200"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {isExporting && progress && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Progress</span>
                <span className="font-mono">{progress.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-[#18181b] rounded-full overflow-hidden border border-[#34B27B]/30">
                <div
                  className="h-full bg-gradient-to-r from-[#34B27B] to-[#2a9964] transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400 mb-1">Frame</div>
                <div className="text-slate-200 font-mono">
                  {progress.currentFrame} / {progress.totalFrames}
                </div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Time Remaining</div>
                <div className="text-slate-200 font-mono">
                  {formatTime(progress.estimatedTimeRemaining)}
                </div>
              </div>
            </div>

            {onCancel && (
              <div className="pt-4 border-t border-[#34B27B]/20">
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="w-full bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancel Export
                </Button>
              </div>
            )}
          </div>
        )}

        {showSuccess && (
          <div className="text-center py-8">
            <p className="text-lg text-slate-200">Video saved successfully!</p>
          </div>
        )}

        {!isExporting && !error && !showSuccess && (
          <div className="text-center py-4">
            <p className="text-slate-400">Ready to export your video</p>
          </div>
        )}
      </div>
    </>
  );
}
