"use client"

import { Download, LoaderCircle, Upload } from "lucide-react"
import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import type { NodeStatusMigrationFile } from "@/lib/nodestatus-admin"
import { Button } from "./ui/button"

type ImportState = {
  message: string
  error: string
}

type Toast = {
  message: string
  error: boolean
}

export function NodeMigrationButtons({
  exportAction,
  importAction,
  exportLabel,
  exportingLabel,
  importLabel,
  importingLabel,
  exportWarning,
  requestFailedLabel,
}: {
  exportAction: () => Promise<NodeStatusMigrationFile>
  importAction: (previousState: ImportState, formData: FormData) => Promise<ImportState>
  exportLabel: string
  exportingLabel: string
  importLabel: string
  importingLabel: string
  exportWarning: string
  requestFailedLabel: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [exporting, startExport] = useTransition()
  const [, formAction, importing] = useActionState(
    async (previousState: ImportState, formData: FormData) => {
      const state = await importAction(previousState, formData)
      showToast(state.error || state.message, Boolean(state.error))
      return state
    },
    { message: "", error: "" },
  )

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current)
    },
    [],
  )

  function showToast(message: string, error: boolean) {
    if (!message) return
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current)

    setToast({ message, error })
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, 8000)
  }

  function handleExport() {
    if (!window.confirm(exportWarning)) return

    startExport(async () => {
      try {
        const data = await exportAction()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")

        link.href = url
        link.download = `nodestatus-nodes-${data.exported_at.slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
      } catch {
        showToast(requestFailedLabel, true)
      }
    })
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full gap-2 sm:w-auto"
          disabled={exporting || importing}
          onClick={handleExport}
        >
          {exporting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {exporting ? exportingLabel : exportLabel}
        </Button>

        <form action={formAction}>
          <input
            ref={inputRef}
            type="file"
            name="file"
            className="sr-only"
            accept=".json,application/json"
            onChange={(event) => {
              if (event.currentTarget.files?.length) {
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />

          <Button
            type="button"
            variant="outline"
            className="h-9 w-full gap-2 sm:w-auto"
            disabled={exporting || importing}
            onClick={() => {
              if (!inputRef.current) return
              inputRef.current.value = ""
              inputRef.current.click()
            }}
          >
            {importing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {importing ? importingLabel : importLabel}
          </Button>
        </form>
      </div>

      {toast && (
        <p
          role={toast.error ? "alert" : "status"}
          className={`fixed inset-x-4 bottom-4 z-50 rounded-md border p-4 font-medium text-sm text-white shadow-xl sm:right-4 sm:left-auto sm:max-w-md ${toast.error ? "border-red-700 bg-red-600 dark:border-red-400 dark:bg-red-950" : "border-emerald-700 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-950"}`}
        >
          {toast.message}
        </p>
      )}
    </div>
  )
}
