"use client"

// The floating zoom control puck. Moved verbatim out of page.tsx during the
// file split: it was already declared at module scope and closes over nothing,
// so this is a pure relocation.

import React, { useState, useRef, useEffect } from "react"
import { Move, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DraggableZoomControls({
    zoomLevel,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    elevated = false,

}: {
    zoomLevel: number
    onZoomIn: () => void
    onZoomOut: () => void
    onResetZoom: () => void
    /** Raise above the table's full-view overlay (z-50) so zoom stays usable there. */
    elevated?: boolean

}) {
    const [position, setPosition] = useState({ x: 1000, y: 40 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const dragRef = useRef<HTMLDivElement>(null)

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        })
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return

            const newX = e.clientX - dragStart.x
            const newY = e.clientY - dragStart.y

            // Constrain to viewport bounds
            const maxX = window.innerWidth - 200
            const maxY = window.innerHeight - 60

            setPosition({
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
            })
        }

        const handleMouseUp = () => {
            setIsDragging(false)
        }

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)

            return () => {
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
            }
        }
    }, [isDragging, dragStart, position])

    return (
        <div
            ref={dragRef}
            className={`fixed ${elevated ? "z-[60]" : "z-50"} bg-white rounded-lg shadow-lg border p-1 flex items-center gap-1 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="flex items-center gap-1 px-1">
                <Move className="w-3 h-3 text-gray-400" />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        onZoomOut()
                    }}
                    className="h-6 w-6 p-0 text-xs"
                    title="Zoom Out Table"
                    disabled={zoomLevel <= 0.5}
                >
                    <ZoomOut className="w-2.5 h-2.5" />
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        onResetZoom()
                    }}
                    className="h-6 px-2 text-xs min-w-[40px]"
                    title="Reset Table Zoom"
                >
                    {Math.round(zoomLevel * 100)}%
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        onZoomIn()
                    }}
                    className="h-6 w-6 p-0 text-xs"
                    title="Zoom In Table"
                    disabled={zoomLevel >= 1}
                >
                    <ZoomIn className="w-2.5 h-2.5" />
                </Button>
            </div>
        </div>
    )
}
