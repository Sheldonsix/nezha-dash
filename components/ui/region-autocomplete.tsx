"use client"

import countries from "i18n-iso-countries"
import enLocale from "i18n-iso-countries/langs/en.json"
import zhLocale from "i18n-iso-countries/langs/zh.json"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

countries.registerLocale(zhLocale)
countries.registerLocale(enLocale)

interface RegionOption {
    code: string
    nameZh: string
    nameEn: string
}

export function RegionAutoComplete({
    defaultValue = "",
    name = "region",
    placeholder = "输入中文/代码如 CN",
    required = false,
}: {
    defaultValue?: string
    name?: string
    placeholder?: string
    required?: boolean
}) {
    const [query, setQuery] = useState(defaultValue)
    const [isOpen, setIsOpen] = useState(false)
    const [results, setResult] = useState<RegionOption[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        const form = containerRef.current?.closest("form")
        const handleReset = () => {
            setQuery(defaultValue)
            setResult([])
            setIsOpen(false)
        }
        form?.addEventListener("reset", handleReset)
        return () => form?.removeEventListener("reset", handleReset)
    }, [defaultValue])

    const handleSearch = (value: string) => {
        setQuery(value)
        const trimmed = value.trim()
        if (!trimmed) {
            setResult([])
            setIsOpen(false)
            return
        }

        const matchedCodes = new Set<string>()

        const codeFromZh = countries.getAlpha2Code(trimmed, "zh")
        if (codeFromZh) matchedCodes.add(codeFromZh)

        const codeFromEn = countries.getAlpha2Code(trimmed, "en")
        if (codeFromEn) matchedCodes.add(codeFromEn)

        const allCodes = Object.keys(countries.getAlpha2Codes())
        const upperInput = trimmed.toUpperCase()

        const codeMatches = allCodes.filter((code) => code.startsWith(upperInput))
        codeMatches.slice(0, 8).forEach((code) => {
            matchedCodes.add(code)
        })

        if (matchedCodes.size < 8) {
            for (const code of allCodes) {
                const nameZh = countries.getName(code, "zh") || ""
                if (nameZh.includes(trimmed)) {
                    matchedCodes.add(code)
                    if (matchedCodes.size >= 8) break
                }
            }
        }

        const formatted: RegionOption[] = Array.from(matchedCodes).map((code) => ({
            code,
            nameEn: countries.getName(code, "en") || code,
            nameZh: countries.getName(code, "zh") || code,
        }))

        setResult(formatted)
        setIsOpen(formatted.length > 0)
    }

    const handleSelect = (code: string) => {
        setQuery(code)
        setIsOpen(false)
    }

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <input
                    name={name}
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => {
                        if (query.trim() && results.length > 0) setIsOpen(true)
                    }}
                    placeholder={placeholder}
                    required={required}
                    maxLength={20}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:ring-ring"
                />
            </div>
            {isOpen && results.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                    {results.map((item) => (
                        <li
                            key={item.code}
                            onClick={() => handleSelect(item.code)}
                            className="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        >
                            <div className="flex items-center gap-2">
                                <span className={cn("fi", `fi-${item.code.toLowerCase()}`)}></span>
                                <span className="font-medium">{item.nameZh}</span>
                                <span className="text-muted-foreground text-xs">({item.nameEn})</span>
                                <span className="font-mono font-semibold text-muted-foreground text-xs">
                                    {item.code}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
