import { Navbar } from "@/components/layout/Navbar"
import { Cart } from "@/components/layout/Cart"
import { Hero } from "@/components/sections/Hero"
import { ProductBento } from "@/components/sections/ProductBento"

function App() {
  return (
    <div className="min-h-screen bg-zinc-50 selection:bg-electric-blue selection:text-white">
      <Navbar />
      <Cart />
      <main>
        <Hero />
        <ProductBento />
      </main>
    </div>
  )
}

export default App
