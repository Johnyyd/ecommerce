import { motion } from "motion/react"
import { Card } from "@/components/ui/Card"
import { ArrowRight } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"

export function ProductBento() {
  const categories = [
    { title: "Apparel", desc: "Engineered fabrics.", span: "col-span-1 md:col-span-8 row-span-2", height: "min-h-[400px] md:min-h-[600px]" },
    { title: "Accessories", desc: "Precision crafted.", span: "col-span-1 md:col-span-4 row-span-1", height: "min-h-[250px] md:min-h-[290px]" },
    { title: "Objects", desc: "Spatial design.", span: "col-span-1 md:col-span-4 row-span-1", height: "min-h-[250px] md:min-h-[290px]" }
  ]

  return (
    <section className="w-full px-4 md:px-12 py-32 bg-zinc-50">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl md:text-5xl tracking-tighter font-medium text-zinc-950 mb-4">
            Curated Categories
          </h2>
          <p className="text-lg text-zinc-500 max-w-lg">
            Discover collections designed with uncompromising attention to detail and materiality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.title}
              className={cat.span}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            >
              <Card className={`w-full group cursor-pointer ${cat.height} flex flex-col justify-end p-8 relative`}>
                <div className="absolute inset-0 bg-zinc-100 m-1.5 rounded-[calc(2rem-0.375rem)] overflow-hidden">
                   {/* Placeholder for real product photography */}
                   <div className="absolute inset-0 bg-gradient-to-t from-zinc-200 to-transparent mix-blend-multiply opacity-50" />
                </div>
                
                <div className="relative z-10 flex items-end justify-between w-full">
                  <div>
                    <h3 className="text-2xl tracking-tight font-medium text-zinc-900 mb-1">{cat.title}</h3>
                    <p className="text-zinc-600">{cat.desc}</p>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      useCartStore.getState().addItem({
                        id: cat.title.toLowerCase(),
                        name: cat.title,
                        price: 150.00,
                        quantity: 1
                      });
                    }}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-zinc-950 transform group-hover:scale-110 transition-transform duration-apple ease-apple hover:bg-zinc-100"
                  >
                    <ArrowRight weight="bold" />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
