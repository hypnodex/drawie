import { useNavigate } from 'react-router-dom'
import { Button, Chip, Dropdown } from '@heroui/react'
import { useAuth } from '../../state/AuthContext'
import { Avatar } from './Avatar'

/**
 * Header profile menu — HeroUI v3 Dropdown compound. Trigger is the user's
 * avatar pill; menu has nav + demo controls (Premium toggle / persona switch / logout).
 */
export function ProfileMenu() {
  const { user, entitlement, users, login, logout, setIsPremium } = useAuth()
  const nav = useNavigate()

  if (!user) {
    return (
      <Button variant="primary" size="md" onPress={() => nav('/login')}>
        Sign in
      </Button>
    )
  }

  const onAction = (key: React.Key) => {
    const k = String(key)
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
    <Dropdown>
      <Dropdown.Trigger className="inline-flex items-center gap-2 pl-1 pr-3 h-10 rounded-full bg-[var(--default)] text-[var(--foreground)] hover:bg-[var(--surface-tertiary)]">
        <Avatar user={user} size={28} />
        <span className="text-sm font-bold hidden sm:inline">{user.name}</span>
        {entitlement?.isPremium && (
          <Chip color="accent" variant="primary" size="sm">Pro</Chip>
        )}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="bg-[var(--surface)] p-1.5 rounded-[var(--radius)] shadow-lg min-w-[220px]">
        <Dropdown.Menu aria-label="Profile menu" onAction={onAction}>
          <Dropdown.Section>
            <Dropdown.Item id="dashboard">Dashboard</Dropdown.Item>
            <Dropdown.Item id="my-canvases">My canvases</Dropdown.Item>
            <Dropdown.Item id="create">Create canvas</Dropdown.Item>
            <Dropdown.Item id="premium">Premium</Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="design-system">Design System ↗</Dropdown.Item>
            <Dropdown.Item id="premium-toggle">
              {entitlement?.isPremium ? 'Turn off Premium' : 'Turn on Premium'}
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            {users.map((u) => (
              <Dropdown.Item key={u.id} id={`switch:${u.id}`} textValue={u.name}>
                <span className="inline-flex items-center gap-2">
                  <Avatar user={u} size={20} />
                  <span>{u.name}</span>
                  {u.isPremium && <Chip color="accent" variant="primary" size="sm" className="ml-1">Pro</Chip>}
                  {u.id === user.id && <span className="text-[10px] text-[var(--muted)] ml-1">Current</span>}
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="logout" className="text-[var(--danger)]">Sign out</Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
