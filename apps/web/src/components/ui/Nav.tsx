import { NavLink, Link as RouterLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/',              label: 'Discover', end: true },
  { to: '/dashboard',     label: 'Dashboard' },
  { to: '/create-canvas', label: 'Create' },
  { to: '/premium',       label: 'Premium' },
]

/**
 * Site header. HeroUI v3 dropped the `Navbar` component so we compose it from
 * native `<header>` + react-router `<NavLink>`s + HeroUI Button/Dropdown.
 */
export function Nav() {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-5 sm:px-10 h-16 bg-[var(--background)]/90 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <RouterLink to="/" className="flex items-center gap-2.5 shrink-0 group" aria-label="Drawie home">
          <span className="flex items-center gap-[3px]" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
            <span className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
            <span className="w-2 h-2 rounded-full bg-[var(--foreground)] transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
            Drawie<sup className="text-[10px] text-[var(--muted)] ml-0.5">®</sup>
          </span>
        </RouterLink>

        <nav className="hidden md:flex items-center gap-1 ml-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => [
                'px-3 h-9 inline-flex items-center rounded-full text-[13px] font-bold transition',
                isActive
                  ? 'bg-[var(--default)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--default)] hover:text-[var(--foreground)]',
              ].join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button
          className="hidden sm:inline-flex font-bold"
          onClick={() => nav('/create-canvas')}
        >
          Start a canvas
        </Button>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  )
}
