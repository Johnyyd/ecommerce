import { Navbar } from "@/components/layout/Navbar"
import { Cart } from "@/components/layout/Cart"
import { Hero } from "@/components/sections/Hero"
import { ProductBento } from "@/components/sections/ProductBento"

export function Storefront() {
  return (
    <>
      <Navbar />
      <Cart />
      <main>
        <Hero />
        
        {/* Category List */}
        <section className="w-full px-4 md:px-12 py-24 bg-white border-y border-zinc-100">
          <div className="max-w-[1400px] mx-auto">
            <h2 className="text-3xl font-medium tracking-tight text-zinc-950 mb-12 text-center">Shop by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: "Apparel", desc: "Minimalist clothing" },
                { name: "Footwear", desc: "Premium sneakers" },
                { name: "Accessories", desc: "Everyday carry" },
                { name: "Home", desc: "Living spaces" }
              ].map((cat, i) => (
                <div key={i} className="group relative aspect-square bg-zinc-50 rounded-3xl overflow-hidden cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent z-10 transition-opacity group-hover:opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-300 font-mono text-xs tracking-widest uppercase">
                    [ Image ]
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 z-20">
                    <h3 className="text-xl font-medium text-white mb-1">{cat.name}</h3>
                    <p className="text-sm text-white/80">{cat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Flash Sale */}
        <section className="w-full px-4 md:px-12 py-24 bg-zinc-950 text-white">
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex-1">
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6">Flash Sale</h2>
              <p className="text-zinc-400 text-lg mb-8 max-w-md">Limited time offers on our most requested pieces. Do not miss out.</p>
              
              <div className="flex gap-4 items-center font-mono text-2xl">
                <div className="bg-white/10 px-4 py-3 rounded-xl backdrop-blur-md">
                  <span className="text-white block text-center">02</span>
                  <span className="text-xs text-zinc-400 uppercase tracking-widest block mt-1">Days</span>
                </div>
                <span className="text-zinc-600">:</span>
                <div className="bg-white/10 px-4 py-3 rounded-xl backdrop-blur-md">
                  <span className="text-white block text-center">14</span>
                  <span className="text-xs text-zinc-400 uppercase tracking-widest block mt-1">Hrs</span>
                </div>
                <span className="text-zinc-600">:</span>
                <div className="bg-white/10 px-4 py-3 rounded-xl backdrop-blur-md">
                  <span className="text-white block text-center">59</span>
                  <span className="text-xs text-zinc-400 uppercase tracking-widest block mt-1">Mins</span>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full relative aspect-video bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden">
                <div className="text-zinc-500 font-mono text-sm tracking-widest uppercase">
                  [ Flash Sale Banner Asset ]
                </div>
            </div>
          </div>
        </section>

        <ProductBento />
      </main>
    </>
  )
}
