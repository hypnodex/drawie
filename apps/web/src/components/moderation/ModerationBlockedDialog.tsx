import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Eyebrow } from '../ui/Eyebrow'

interface Props {
  isOpen: boolean
  onClose: () => void
  message: string
  /** Whether the block was a true error (couldn't verify) vs inappropriate content. */
  isError?: boolean
}

/**
 * Shown when moderation prevents a Save / Submit. Purely informational — it never touches the
 * user's work; closing returns them to the canvas to edit and retry. (Phase 2: HeroUI Modal → shadcn Dialog.)
 */
export function ModerationBlockedDialog({ isOpen, onClose, message, isError }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <Eyebrow variant="dot">Content review</Eyebrow>
          <DialogTitle className="mt-1 text-xl font-extrabold tracking-tight">
            {isError ? 'Couldn’t check this canvas' : 'Canvas can’t be saved'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]">
            <WarnIcon />
          </span>
          <p className="text-sm text-[var(--muted)] leading-relaxed">{message}</p>
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={onClose}>
            {isError ? 'Back to canvas' : 'Edit canvas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WarnIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}
