import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  CheckCircle, 
  MapPin, 
  Clock, 
  Copy, 
  Check, 
  X, 
  ArrowSquareOut,
  PhoneCall
} from '@phosphor-icons/react';
import { ShippingTimelineResponse } from '@/types/shipping';
import { toast } from 'sonner';

interface OrderTrackingTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShippingTimelineResponse | null;
  isLoading?: boolean;
}

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  isOpen,
  onClose,
  data,
  isLoading = false,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Tracking code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-8"
        >
          {/* Header Banner with GHN branding */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              <X size={18} weight="bold" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/25 text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm">
                Real-time Express Logistics
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">
                  {data?.carrier_name || 'Giao Hàng Nhanh (GHN Express)'}
                </h3>
                <p className="text-xs text-orange-100 mt-0.5">
                  Official shipping partner • Direct dispatch & real-time route telemetry
                </p>
              </div>
            </div>

            {/* Tracking Code Chip */}
            {data?.tracking_code && (
              <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/25 backdrop-blur-md border border-white/20 text-xs">
                <span className="text-orange-200 font-medium">Tracking Code:</span>
                <span className="font-mono font-bold tracking-wider text-white">
                  {data.tracking_code}
                </span>
                <button
                  onClick={() => handleCopyCode(data.tracking_code)}
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                  title="Copy code"
                >
                  {copied ? <Check size={14} className="text-emerald-300" weight="bold" /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* Body content */}
          <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-zinc-400">
                <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-3" />
                Connecting to GHN Express telemetry...
              </div>
            ) : !data ? (
              <div className="py-12 text-center text-zinc-500">
                No tracking information available for this shipment yet.
              </div>
            ) : (
              <div>
                {/* Status overview card */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-8 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                      <Truck size={22} weight="bold" />
                    </div>
                    <div>
                      <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold uppercase tracking-wider">
                        Current Status
                      </div>
                      <div className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                        {data.current_status_desc}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={data.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
                    >
                      <span>GHN Portal</span>
                      <ArrowSquareOut size={14} />
                    </a>
                    <a
                      href={`tel:${data.hotline}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-sm"
                    >
                      <PhoneCall size={14} weight="fill" />
                      <span>{data.hotline}</span>
                    </a>
                  </div>
                </div>

                {/* Progress Stepper Bar */}
                <div className="mb-8 px-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-zinc-400">Step {data.current_step} of 5</span>
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      {Math.round((data.current_step / 5) * 100)}% Fulfilled
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.current_step / 5) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full"
                    />
                  </div>
                </div>

                {/* Timeline detailed stages */}
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                  {data.timeline.map((step, idx) => {
                    const isDone = step.is_completed;
                    const isNow = step.is_current;

                    return (
                      <div key={step.step ?? step.status_code ?? idx} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isNow
                              ? 'bg-orange-500 text-white ring-4 ring-orange-500/20 shadow-md scale-110'
                              : isDone
                              ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/10'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
                          }`}
                        >
                          {isDone && !isNow ? (
                            <CheckCircle size={14} weight="fill" />
                          ) : (
                            <span className="text-[10px] font-bold">{step.step}</span>
                          )}
                        </div>

                        {/* Event Content Card */}
                        <div
                          className={`p-4 rounded-2xl border transition-all ${
                            isNow
                              ? 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40 shadow-sm'
                              : isDone
                              ? 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200/70 dark:border-zinc-800'
                              : 'bg-transparent border-dashed border-zinc-200 dark:border-zinc-800 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <h4
                              className={`font-semibold text-sm ${
                                isNow
                                  ? 'text-orange-950 dark:text-orange-200'
                                  : isDone
                                  ? 'text-zinc-900 dark:text-zinc-100'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {step.title}
                            </h4>
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                              <Clock size={12} />
                              {step.timestamp}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-2">
                            {step.subtitle}
                          </p>

                          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            <MapPin size={13} className="text-orange-500" />
                            <span>{step.location}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 px-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
