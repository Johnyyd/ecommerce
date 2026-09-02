import { motion } from "motion/react"
import { ArrowUpRight } from "@phosphor-icons/react"
import { Button } from "@/components/ui/Button"

export function Hero() {
  return (
    <section className="relative min-h-[100dvh] w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-12 pt-24 pb-12 overflow-hidden">
      <div className="w-full md:w-1/2 flex flex-col items-start gap-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col gap-6"
        >
          <h1 className="text-6xl md:text-8xl font-sans tracking-tighter leading-[1.05] text-zinc-950 text-balance">
            The aesthetic of commerce.
          </h1>
          <p className="text-xl md:text-2xl text-zinc-600 max-w-md leading-relaxed">
            Elevating everyday transactions into premium digital experiences with unmatched precision and fluidity.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1, ease: [0.32, 0.72, 0, 1] }}
        >
          <Button icon={<ArrowUpRight weight="bold" className="text-zinc-950" />}>
            Explore Collection
          </Button>
        </motion.div>
      </div>

      <div className="w-full md:w-1/2 h-[60vh] md:h-[80vh] mt-12 md:mt-0 relative flex items-center justify-center">
        {/* Placeholder for editorial image asset */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.3, duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
          className="w-full h-full bg-zinc-200/50 rounded-[2rem] border border-zinc-200 flex items-center justify-center overflow-hidden"
        >
          <div className="text-zinc-400 font-mono text-sm tracking-widest uppercase">
            [ Editorial Asset Placeholder ]
          </div>
        </motion.div>
      </div>
    </section>
  )
}
