'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
  keywords?: string[]
  disabled?: boolean
}

type SearchableSelectProps = {
  id?: string
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
}

type SearchableMultiSelectProps = {
  id?: string
  value: string[]
  options: SearchableSelectOption[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options',
  emptyMessage = 'No options found.',
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  className,
}: SearchableSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listboxRef = React.useRef<HTMLDivElement>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [mounted, setMounted] = React.useState(false)
  const [popupStyle, setPopupStyle] = React.useState<React.CSSProperties>()

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  )

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    if (!normalizedQuery) return options

    return options.filter((option) => {
      const haystack = normalizeSearch(
        [
          option.label,
          option.description,
          ...(option.keywords || []),
        ]
          .filter(Boolean)
          .join(' '),
      )

      return haystack.includes(normalizedQuery)
    })
  }, [options, query])

  const enabledOptions = filteredOptions.filter((option) => !option.disabled)

  const updatePopupPosition = React.useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const viewportPadding = 12
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding
    const maxHeight = Math.max(180, Math.min(320, availableBelow - 6))

    setPopupStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 80,
    })
  }, [])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === value && !option.disabled,
    )
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)

    window.requestAnimationFrame(() => {
      updatePopupPosition()
      searchRef.current?.focus()
    })
  }, [open, updatePopupPosition, value])

  React.useEffect(() => {
    if (!open) return

    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)

    return () => {
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open, updatePopupPosition])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  React.useEffect(() => {
    if (!open) return

    const listbox = listboxRef.current
    const option = optionRefs.current[activeIndex]
    if (!listbox || !option) return

    const optionTop = option.offsetTop
    const optionBottom = optionTop + option.offsetHeight
    const visibleTop = listbox.scrollTop
    const visibleBottom = visibleTop + listbox.clientHeight

    if (optionTop < visibleTop) {
      listbox.scrollTop = optionTop
    } else if (optionBottom > visibleBottom) {
      listbox.scrollTop = optionBottom - listbox.clientHeight
    }
  }, [activeIndex, open])

  const selectOption = (option: SearchableSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    setQuery('')
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }

  const moveActive = (direction: 1 | -1) => {
    if (enabledOptions.length === 0) return

    const currentOption = filteredOptions[activeIndex]
    const currentEnabledIndex = enabledOptions.findIndex(
      (option) => option.value === currentOption?.value,
    )
    const nextEnabledIndex =
      currentEnabledIndex < 0
        ? direction > 0
          ? 0
          : enabledOptions.length - 1
        : (currentEnabledIndex + direction + enabledOptions.length) %
          enabledOptions.length
    const nextOption = enabledOptions[nextEnabledIndex]
    setActiveIndex(
      Math.max(
        0,
        filteredOptions.findIndex((option) => option.value === nextOption.value),
      ),
    )
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const option = filteredOptions[activeIndex]
      if (option) selectOption(option)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setQuery('')
      buttonRef.current?.focus()
    }
  }

  const listboxId = id ? `${id}-listbox` : undefined
  const popup = open && popupStyle ? (
    <div
      ref={popupRef}
      className="overflow-hidden rounded-xl border border-[#dbe3ee] bg-white shadow-[0_20px_45px_-24px_rgba(15,23,42,0.45)]"
      style={popupStyle}
    >
      <div className="flex items-center gap-2 border-b border-[#e8edf4] px-3 py-2">
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder={searchPlaceholder}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm text-[#17213c] outline-none placeholder:text-[#94a3b8]"
        />
      </div>
      <div
        ref={listboxRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={id}
        className="overflow-y-auto p-1.5"
        style={{
          maxHeight:
            typeof popupStyle?.maxHeight === 'number'
              ? popupStyle.maxHeight - 49
              : 256,
        }}
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => {
            const selected = option.value === value
            const active = index === activeIndex

            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                  active ? 'bg-[#eef5ff]' : 'bg-white',
                  option.disabled
                    ? 'cursor-not-allowed text-[#94a3b8]'
                    : 'text-[#17213c] hover:bg-[#eef5ff]',
                )}
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected ? (
                    <Check className="h-3.5 w-3.5 text-[#2563eb]" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-[#64748b]">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })
        ) : (
          <p className="px-3 py-5 text-center text-sm text-[#64748b]">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => {
            if (!current) updatePopupPosition()
            return !current
          })
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'ArrowDown' ||
            event.key === 'ArrowUp' ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault()
            updatePopupPosition()
            setOpen(true)
          }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2 text-left text-sm text-[#17213c] outline-none transition',
          'hover:border-[#b8c6d8] focus:ring-4',
          invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
            : 'border-[#dbe3ee] focus:border-[#93b4f8] focus:ring-[#dbeafe]/70',
          'disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-[#94a3b8]',
          className,
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            !selectedOption && 'text-[#94a3b8]',
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[#64748b] transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {mounted && popup ? createPortal(popup, document.body) : null}
    </div>
  )
}

export function SearchableMultiSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select options',
  searchPlaceholder = 'Search options',
  emptyMessage = 'No options found.',
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  className,
}: SearchableMultiSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [mounted, setMounted] = React.useState(false)
  const [popupStyle, setPopupStyle] = React.useState<React.CSSProperties>()

  const selectedValues = React.useMemo(() => new Set(value), [value])
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedValues.has(option.value)),
    [options, selectedValues],
  )
  const selectedLabel =
    selectedOptions.length === 0
      ? ''
      : selectedOptions.length <= 2
        ? selectedOptions.map((option) => option.label).join(', ')
        : `${selectedOptions.length} selected`

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    if (!normalizedQuery) return options

    return options.filter((option) => {
      const haystack = normalizeSearch(
        [
          option.label,
          option.description,
          ...(option.keywords || []),
        ]
          .filter(Boolean)
          .join(' '),
      )

      return haystack.includes(normalizedQuery)
    })
  }, [options, query])

  const updatePopupPosition = React.useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const viewportPadding = 12
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding
    const maxHeight = Math.max(180, Math.min(340, availableBelow - 6))

    setPopupStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 80,
    })
  }, [])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    window.requestAnimationFrame(() => {
      updatePopupPosition()
      searchRef.current?.focus()
    })
  }, [open, updatePopupPosition])

  React.useEffect(() => {
    if (!open) return

    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)

    return () => {
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open, updatePopupPosition])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const toggleOption = (option: SearchableSelectOption) => {
    if (option.disabled) return

    if (selectedValues.has(option.value)) {
      onChange(value.filter((entry) => entry !== option.value))
      return
    }

    onChange([...value, option.value])
  }

  const listboxId = id ? `${id}-listbox` : undefined
  const popup = open && popupStyle ? (
    <div
      ref={popupRef}
      className="overflow-hidden rounded-xl border border-[#dbe3ee] bg-white shadow-[0_20px_45px_-24px_rgba(15,23,42,0.45)]"
      style={popupStyle}
    >
      <div className="flex items-center gap-2 border-b border-[#e8edf4] px-3 py-2">
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setQuery('')
              buttonRef.current?.focus()
            }
          }}
          placeholder={searchPlaceholder}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm text-[#17213c] outline-none placeholder:text-[#94a3b8]"
        />
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-labelledby={id}
        aria-multiselectable="true"
        className="overflow-y-auto p-1.5"
        style={{
          maxHeight:
            typeof popupStyle?.maxHeight === 'number'
              ? popupStyle.maxHeight - 49
              : 276,
        }}
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const selected = selectedValues.has(option.value)

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => toggleOption(option)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                  option.disabled
                    ? 'cursor-not-allowed text-[#94a3b8]'
                    : 'text-[#17213c] hover:bg-[#eef5ff]',
                  selected && 'bg-[#eef5ff]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    selected
                      ? 'border-[#2563eb] bg-[#2563eb] text-white'
                      : 'border-[#cbd5e1] bg-white',
                  )}
                >
                  {selected ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-[#64748b]">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })
        ) : (
          <p className="px-3 py-5 text-center text-sm text-[#64748b]">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => {
            if (!current) updatePopupPosition()
            return !current
          })
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'ArrowDown' ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault()
            updatePopupPosition()
            setOpen(true)
          }
        }}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2 text-left text-sm text-[#17213c] outline-none transition',
          'hover:border-[#b8c6d8] focus:ring-4',
          invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
            : 'border-[#dbe3ee] focus:border-[#93b4f8] focus:ring-[#dbeafe]/70',
          'disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-[#94a3b8]',
          className,
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            !selectedLabel && 'text-[#94a3b8]',
          )}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[#64748b] transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {mounted && popup ? createPortal(popup, document.body) : null}
    </div>
  )
}
