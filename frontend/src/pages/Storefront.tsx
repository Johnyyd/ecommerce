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
        <ProductBento />
      </main>
    </>
  )
}
