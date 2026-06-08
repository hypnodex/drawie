import { Surface } from '@heroui/react'
import { Eyebrow } from '../components/ui/Eyebrow'
import { Heading } from '../components/ui/Heading'

export function ComingSoon({ name }: { name: string }) {
  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-14">
      <Surface variant="secondary" className="rounded-[var(--radius)] p-12 text-center">
        <Eyebrow variant="dot">Drawie2 / Turn 2</Eyebrow>
        <Heading level={1} size="lg" className="mt-3">{name}</Heading>
        <p className="mt-3 text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          Ported in a subsequent turn. The route is reserved so the rest of the app can link here.
        </p>
      </Surface>
    </div>
  )
}
