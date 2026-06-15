import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind class combiner (clsx + tailwind-merge) — the native twin of the web's cn(). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
