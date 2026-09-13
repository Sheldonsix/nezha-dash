"use client"

import { Button, type ButtonProps } from "@/components/ui/button"

export function ConfirmSubmitButton({ message, ...props }: ButtonProps & { message: string }) {
    return (
        <Button
            {...props}
            onClick={(event) => {
                if (!window.confirm(message)) event.preventDefault()
            }}
        />
    )
}
