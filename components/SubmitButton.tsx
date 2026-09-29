"use client"

import { LoaderCircle } from "lucide-react"
import { useFormStatus } from "react-dom"
import { Button, type ButtonProps } from "./ui/button"

export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button {...props} disabled={disabled || pending} aria-busy={pending}>
      {pending && <LoaderCircle aria-hidden className="mr-2 size-4 animate-spin" />}
      {children}
    </Button>
  )
}
