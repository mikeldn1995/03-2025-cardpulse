"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface InlineEditProps {
  value: string | number
  displayValue: string
  onSave: (value: string) => void
  type?: "text" | "number"
  className?: string
  inputClassName?: string
  step?: string
  min?: string
  max?: string
}

export function InlineEdit({ value, displayValue, onSave, type = "text", className, inputClassName, step, min, max }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = () => {
    setEditing(false)
    onSave(draft)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        step={step}
        min={min}
        max={max}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === "Enter") inputRef.current?.blur()
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false) }
        }}
        className={cn(
          "h-7 px-2 text-sm font-medium bg-background border border-ring rounded-md outline-none shadow-sm",
          inputClassName
        )}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      className={cn("cursor-pointer border-b border-dashed border-border hover:border-ring pb-px transition-colors", className)}
      onClick={e => { e.stopPropagation(); setDraft(String(value)); setEditing(true) }}
    >
      {displayValue}
    </span>
  )
}
