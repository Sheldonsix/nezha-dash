"use client"

import { LoaderCircle } from "lucide-react"
import { useFormStatus } from "react-dom"
import { Button, type ButtonProps } from "@/components/ui/button"

export function ConfirmSubmitButton({
  message,
  children,
  disabled,
  ...props
}: ButtonProps & { message: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {pending && <LoaderCircle aria-hidden className="mr-2 size-4 animate-spin" />}
      {children}
    </Button>
  )
}
