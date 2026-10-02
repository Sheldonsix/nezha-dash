"use client"

import { LoaderCircle, Plus } from "lucide-react"
import { type ReactNode, useActionState, useEffect } from "react"
import { type CreatedNodeCommand, useCreatedNodeCommand } from "./CreatedNodeCommand"
import { Button } from "./ui/button"

type CreateServerState = CreatedNodeCommand & {
  error: string
}

export function CreateServerForm({
  createAction,
  createLabel,
  creatingLabel,
  children,
}: {
  createAction: (previousState: CreateServerState, formData: FormData) => Promise<CreateServerState>
  children?: ReactNode
  createLabel: string
  creatingLabel: string
}) {
  const { setCreatedNode } = useCreatedNodeCommand()
  const [state, formAction, pending] = useActionState(createAction, {
    command: "",
    username: "",
    error: "",
  })
  useEffect(() => {
    if (state.username && state.command) {
      setCreatedNode(state)
    }
  }, [state, setCreatedNode])
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {children}
      {state.error && (
        <p role="alert" className="col-span-full text-destructive text-sm">
          {state.error}
        </p>
      )}
      <div className="col-span-full flex sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          <span aria-live="polite">{pending ? creatingLabel : createLabel}</span>
        </Button>
      </div>
    </form>
  )
}
