import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { Heading } from '../ui/Heading'

/**
 * Editorial hero — display headline + lede + CTA. Decorative eyebrow labels
 * removed for a cleaner page header.
 */
export function HeroSection() {
  const nav = useNavigate()
  return (
    <section className="relative bg-[var(--background)]">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <Heading
          level={1}
          size="3xl"
          className="!text-[3rem] sm:!text-[5rem] lg:!text-[6.5rem]"
        >
          One canvas.
          <br />
          Many&nbsp;hands.
          <br />
          <span className="text-[var(--muted)]">A surprise at the end.</span>
        </Heading>

        <div className="mt-10 grid sm:grid-cols-12 gap-8 sm:gap-12 items-start">
          <p className="sm:col-span-7 text-base sm:text-lg leading-relaxed text-[var(--muted)] max-w-xl">
            Every artwork is broken into hidden tiles. You only see yours — and a thin
            edge from each neighbor. When everyone finishes, the full mosaic is revealed.
          </p>
          <div className="sm:col-span-5 flex flex-wrap items-center gap-3 sm:justify-end">
            <Button size="lg" onClick={() => {
              const el = document.getElementById('trending')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}>
              Browse canvases <span aria-hidden>→</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => nav('/draw')}>
              Try the engine
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
