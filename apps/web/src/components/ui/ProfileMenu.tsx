import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '../../state/AuthContext'
import { Avatar } from './Avatar'

/**
 * Header profile menu. (Phase 2: HeroUI v3 Dropdown compound → shadcn DropdownMenu.)
 * Trigger is the user's avatar pill; menu has nav + demo controls (Premium toggle /
 * persona switch / logout). HeroUI's single `onAction(key)` dispatch is split into
 * per-item `onSelect` handlers routed through `act()`.
 */
export function ProfileMenu() {
  const { user, entitlement, users, login, logout, setIsPremium } = useAuth()
  const nav = useNavigate()

  if (!user) {
    return (
      <Button onClick={() => nav('/login')}>Sign in</Button>
    )
  }

  const act = (k: string) => {
    if (k === 'dashboard')             nav('/dashboard')
    else if (k === 'my-canvases')      nav('/dashboard/canvases')
    else if (k === 'create')           nav('/create-canvas')
    else if (k === 'premium')          nav('/premium')
    else if (k === 'design-system')    nav('/design-system')
    else if (k === 'premium-toggle')   setIsPremium(!entitlement?.isPremium)
    else if (k.startsWith('switch:')) login(k.slice('switch:'.length))
    else if (k === 'logout')           { logout(); nav('/login') }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 pl-1 pr-3 h-10 rounded-full bg-[var(--default)] text-[var(--foreground)] outline-none hover:bg-[var(--surface-tertiary)] focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Avatar user={user} size={28} />
        <span className="text-sm font-bold hidden sm:inline">{user.name}</span>
        {entitlement?.isPremium && <Badge>Pro</Badge>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => act('dashboard')}>Dashboard</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act('my-canvases')}>My canvases</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act('create')}>Create canvas</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act('premium')}>Premium</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => act('design-system')}>Design System ↗</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act('premium-toggle')}>
            {entitlement?.isPremium ? 'Turn off Premium' : 'Turn on Premium'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {users.map((u) => (
            <DropdownMenuItem key={u.id} onSelect={() => act(`switch:${u.id}`)} textValue={u.name}>
              <span className="inline-flex items-center gap-2">
                <Avatar user={u} size={20} />
                <span>{u.name}</span>
                {u.isPremium && <Badge className="ml-1">Pro</Badge>}
                {u.id === user.id && <span className="text-[10px] text-[var(--muted)] ml-1">Current</span>}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => act('logout')}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
