import { createContext, useContext } from "react"

export const TextStyleEditContext = createContext<((id: string) => void) | null>(null)

export function useTextStyleEdit(): ((id: string) => void) | null {
  return useContext(TextStyleEditContext)
}
