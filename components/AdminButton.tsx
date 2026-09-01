"use client"

import Link from "next/link"
import { Button } from "./ui/button"
import { PencilSquareIcon } from "@heroicons/react/20/solid"

export function AdminButton() {


  return (
    <Link href="/admin" prefetch={true}>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer rounded-full bg-white px-[9px] hover:bg-accent/50 dark:bg-black dark:hover:bg-accent/50"
        title="Network Charts"
      >
        <PencilSquareIcon className="size-4" />
        <span className="sr-only">Edit</span>
      </Button>
    </Link>
  )
}
