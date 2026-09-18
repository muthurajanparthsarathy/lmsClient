"use client"

import { useEffect, useRef, useState } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

interface SummaryTutorialProps {
  isOpen: boolean
  hasGeneratedFirstSummary?: boolean
  hasUploadedFile?: boolean
  onComplete?: () => void
}

export default function SummaryTutorial({
  isOpen,
  hasGeneratedFirstSummary = false,
  hasUploadedFile = false,
  onComplete
}: SummaryTutorialProps) {
  const tourRef = useRef<Shepherd.Tour | null>(null)
  const [tourReady, setTourReady] = useState(false)
  const stepElementsRef = useRef<{
    dropdown?: HTMLElement;
    checkbox?: HTMLElement;
    generateButton?: HTMLElement;
  }>({})

  const cleanupHighlights = () => {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight')
    })
    document.querySelectorAll('.dropdown-open-highlight').forEach(el => {
      el.classList.remove('dropdown-open-highlight')
    })
  }

  useEffect(() => {
    if (!isOpen || tourReady) return

    const startTour = () => {
      const modalExists = document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white')
      if (!modalExists) {
        if (onComplete) onComplete()
        return
      }

      setupTour()
      setTourReady(true)
    }

    requestAnimationFrame(() => {
      startTour()
    })
  }, [isOpen, tourReady])

  // Find the MODULE dropdown button (always)
  const findModuleDropdownButton = (): HTMLElement | null => {
    const modal = document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white')
    if (!modal) return null

    // Look for "Modules" dropdown specifically
    const allDropdowns = modal.querySelectorAll('.relative')
    
    for (const dropdown of allDropdowns) {
      const button = dropdown.querySelector('button, .px-3.py-2, .h-10') as HTMLElement
      if (button) {
        // Check if it contains "Modules" text
        const buttonText = button.textContent || ''
        const hasModules = buttonText.includes('Modules') || 
                          buttonText.includes('Module') ||
                          (buttonText.includes('Select') && buttonText.includes('selected'))
        
        if (hasModules) {
          return button
        }
      }
    }

    // Fallback: Look for any dropdown with chevron
    for (const dropdown of allDropdowns) {
      const hasChevron = dropdown.querySelector('svg[data-icon="chevron-down"], .lucide-chevron-down, svg.lucide-chevron-down')
      if (hasChevron) {
        const button = dropdown.querySelector('button, .px-3.py-2, .h-10') as HTMLElement
        if (button) return button
      }
    }

    // Last resort: First dropdown-like element
    const firstDropdown = modal.querySelector('.relative')
    if (firstDropdown) {
      const button = firstDropdown.querySelector('button, .px-3.py-2, .h-10') as HTMLElement
      return button || firstDropdown as HTMLElement
    }

    return null
  }

  // Find the dropdown content/checkboxes area (when dropdown is open)
  const findDropdownCheckboxesArea = (): HTMLElement | null => {
    const modal = document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white')
    if (!modal) return null

    // Look for dropdown content container
    const dropdownContent = modal.querySelector('.absolute.top-full, .shadow-lg.border-gray-200, .z-20.bg-white, .border.rounded-md')
    if (dropdownContent) {
      return dropdownContent as HTMLElement
    }

    // Look for checkboxes inside dropdown
    const checkboxContainer = modal.querySelector('input[type="checkbox"], .checkbox-container, .space-y-2')
    if (checkboxContainer) {
      // Go up to find the parent container
      let parent = checkboxContainer.parentElement
      while (parent && !parent.classList.contains('fixed')) {
        if (parent.classList.contains('absolute') || parent.classList.contains('z-20') || 
            parent.classList.contains('shadow-lg') || parent.classList.contains('border')) {
          return parent
        }
        parent = parent.parentElement
      }
      return checkboxContainer.parentElement as HTMLElement
    }

    return null
  }

  const findGenerateButton = (): HTMLElement | null => {
    const modal = document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white')
    if (!modal) return null

    const generateButton = modal.querySelector('[data-tutorial="generate-button"]')
    if (generateButton) {
      return generateButton as HTMLElement
    }

    // Look for button with Sparkles icon
    const buttons = modal.querySelectorAll('button')
    for (const button of buttons) {
      const hasSparkles = button.querySelector('.lucide-sparkles, [data-icon="sparkles"]')
      if (hasSparkles && (button.textContent?.includes('Generate') || button.textContent?.includes('Summary'))) {
        return button as HTMLElement
      }
    }

    // Look for gradient blue button
    for (const button of buttons) {
      const style = window.getComputedStyle(button)
      const background = style.background || style.backgroundImage
      if ((background.includes('gradient') || background.includes('#6ECBFF') || background.includes('#3BA9FF')) && 
          button.textContent?.includes('Generate')) {
        return button as HTMLElement
      }
    }

    return null
  }

  const createStepIndicator = (current: number, total: number) => {
    const container = document.createElement('div')
    container.className = 'step-indicator'

    for (let i = 1; i <= total; i++) {
      const dot = document.createElement('div')
      dot.className = `step-dot ${i === current ? 'active' : ''}`
      container.appendChild(dot)
    }

    return container
  }

  const addHighlight = (element: Element | null) => {
    if (element) {
      element.classList.add('tutorial-highlight')
    }
  }

  const ensureDropdownClosed = () => {
    const modal = document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white') as HTMLElement
    if (modal) {
      // Click modal to close any open dropdowns
      modal.click()
      
      // Also look for close button in dropdown
      const closeButtons = modal.querySelectorAll('button')
      for (const button of closeButtons) {
        if (button.textContent?.includes('×') || button.innerHTML?.includes('&times;')) {
          const rect = button.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            button.click()
          }
        }
      }
    }
  }

  const setupTour = () => {
    if (tourRef.current) {
      tourRef.current.complete()
    }

    stepElementsRef.current = {}

    tourRef.current = new Shepherd.Tour({
      defaultStepOptions: {
        cancelIcon: {
          enabled: false
        },
        scrollTo: {
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        },
        arrow: false,
        classes: 'shepherd-theme-modern',
        popperOptions: {
          modifiers: [{
            name: 'offset',
            options: { offset: [0, 12] }
          },
          {
            name: 'preventOverflow',
            options: {
              boundary: document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white') || document.body,
              padding: 20
            }
          }]
        }
      },
      useModalOverlay: true,
      keyboardNavigation: true,
      exitOnEsc: true
    })

    const style = document.createElement('style')
    style.textContent = `
      .shepherd-theme-modern {
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        max-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        z-index: 99999 !important;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        overflow: hidden;
      }

      .shepherd-theme-modern .shepherd-content {
        padding: 0;
        border-radius: 12px;
      }

      .shepherd-theme-modern .shepherd-text {
        font-size: 14px;
        line-height: 1.5;
        padding: 20px;
        color: #374151;
        font-weight: 400;
      }

      .shepherd-theme-modern .shepherd-footer {
        padding: 0 20px 16px;
        gap: 8px;
        display: flex;
        justify-content: flex-end;
        background: transparent;
      }

      .shepherd-theme-modern .shepherd-button {
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        color:#fff !important;
      }

      .shepherd-theme-modern .shepherd-button.shepherd-button-primary,
      .shepherd-button-primary {
        background: #f97316 !important;
        color: #ffffff !important;
        font-weight: 600 !important;
      }

      .shepherd-theme-modern .shepherd-button.shepherd-button-primary:hover {
        background: #ea580c !important;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(249, 115, 22, 0.3);
      }

      .shepherd-theme-modern .shepherd-button:not(:disabled):hover {
        opacity: 0.95;
      }

      .shepherd-theme-modern .shepherd-button[disabled] {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      .shepherd-theme-modern .shepherd-button:not([disabled]) {
        opacity: 1 !important;
        cursor: pointer !important;
      }

      .shepherd-theme-modern .shepherd-button-secondary {
        background: #ffffff;
        color: #4b5563 !important;
        border: 1px solid #d1d5db;
      }

      .shepherd-theme-modern .shepherd-button-secondary:hover {
        background: #f9fafb;
        opacity: 0.9 !important;
      }

      .step-indicator {
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
      }

      .step-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #e5e7eb;
        transition: all 0.2s ease;
      }

      .step-dot.active {
        width: 20px;
        border-radius: 3px;
        background: #f97316;
      }

      .tutorial-highlight {
        border: 2px solid #f97316 !important;
        border-radius: 8px !important;
        position: relative !important;
        z-index: 99999 !important;
        background-color: rgba(249, 115, 22, 0.05) !important;
        box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1) !important;
        animation: pulse-highlight 2s infinite !important;
      }

      .dropdown-open-highlight {
        background-color: rgba(249, 115, 22, 0.05) !important;
        border: 2px solid #f97316 !important;
        border-radius: 8px !important;
        animation: pulse-highlight 2s infinite !important;
      }

      @keyframes pulse-highlight {
        0% {
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.3);
        }
        70% {
          box-shadow: 0 0 0 6px rgba(249, 115, 22, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .shepherd-theme-modern {
        animation: fadeIn 0.3s ease-out;
      }

      .shepherd-element.shepherd-enabled {
        position: fixed !important;
        z-index: 99999 !important;
      }
    `
    document.head.appendChild(style)

    // Track dropdown state
    let dropdownShouldBeOpen = false

    // Step 1: Open Module Dropdown
    tourRef.current.addStep({
      id: 'select-module',
      title: '',
      text: `1. Open modules dropdown to view available items`,
      attachTo: {
        element: () => {
          const dropdown = findModuleDropdownButton()
          if (dropdown) {
            addHighlight(dropdown)
            return dropdown
          }
          return document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white') || document.body
        },
        on: 'bottom'
      },
      beforeShowPromise: function() {
        return new Promise<void>((resolve) => {
          cleanupHighlights()
          
          // Ensure all dropdowns are closed at the start
          ensureDropdownClosed()
          dropdownShouldBeOpen = false
          
          setTimeout(() => resolve(), 200)
        })
      },
      buttons: [
        {
          text: 'Skip',
          action: () => {
            cleanupHighlights()
            tourRef.current?.cancel()
            if (onComplete) onComplete()
          },
          secondary: true
        },
        {
          text: 'Next',
          action: () => {
            cleanupHighlights()
            
            // Click the module dropdown to open it
            const dropdown = findModuleDropdownButton()
            if (dropdown) {
              dropdown.click()
              dropdownShouldBeOpen = true
              
              // Wait for dropdown to open
              setTimeout(() => {
                tourRef.current?.next()
              }, 400)
            } else {
              tourRef.current?.next()
            }
          }
        }
      ],
      when: {
        show: () => {
          setTimeout(() => {
            const stepElement = document.querySelector('.shepherd-step[data-id="select-module"]')
            if (stepElement) {
              const textContainer = stepElement.querySelector('.shepherd-text')
              if (textContainer) {
                const indicator = createStepIndicator(1, 3)
                textContainer.insertBefore(indicator, textContainer.firstChild)
              }
            }
          }, 10)
        }
      }
    })

    // Step 2: Select Items from Dropdown (Highlight checkboxes area)
    tourRef.current.addStep({
      id: 'select-checkbox',
      title: '',
      text: `2. Select items by checking boxes inside the dropdown`,
      attachTo: {
        element: () => {
          // If dropdown should be open, look for checkboxes area
          if (dropdownShouldBeOpen) {
            const checkboxesArea = findDropdownCheckboxesArea()
            if (checkboxesArea) {
              addHighlight(checkboxesArea)
              return checkboxesArea
            }
          }
          
          // Fallback: use module dropdown button
          const dropdown = findModuleDropdownButton()
          if (dropdown) {
            addHighlight(dropdown)
            return dropdown
          }
          
          return document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white') || document.body
        },
        on: 'right'
      },
      beforeShowPromise: function() {
        return new Promise<void>((resolve) => {
          cleanupHighlights()
          
          // Ensure dropdown is open if it should be
          if (dropdownShouldBeOpen) {
            // Check if dropdown is already open
            const modal = document.querySelector('.fixed.inset-0.bg-black\\/50 .bg-white')
            const openDropdown = modal?.querySelector('.absolute.top-full, .shadow-lg.border-gray-200, .z-20.bg-white')
            
            if (!openDropdown) {
              // Click to open dropdown
              const dropdown = findModuleDropdownButton()
              if (dropdown) {
                dropdown.click()
                setTimeout(() => {
                  // Highlight checkboxes area if found
                  const checkboxesArea = findDropdownCheckboxesArea()
                  if (checkboxesArea) {
                    addHighlight(checkboxesArea)
                  }
                  resolve()
                }, 400)
                return
              }
            } else {
              // Highlight checkboxes area if found
              const checkboxesArea = findDropdownCheckboxesArea()
              if (checkboxesArea) {
                addHighlight(checkboxesArea)
              }
            }
          }
          
          resolve()
        })
      },
      buttons: [
        {
          text: 'Back',
          action: () => {
            cleanupHighlights()
            
            // Close dropdown when going back to step 1
            ensureDropdownClosed()
            dropdownShouldBeOpen = false
            
            // Go back to step 1
            tourRef.current?.back()
          },
          secondary: true
        },
        {
          text: 'Next',
          action: () => {
            cleanupHighlights()
            
            // Close dropdown before moving to next step
            ensureDropdownClosed()
            dropdownShouldBeOpen = false
            
            setTimeout(() => tourRef.current?.next(), 300)
          }
        }
      ],
      when: {
        show: () => {
          setTimeout(() => {
            const stepElement = document.querySelector('.shepherd-step[data-id="select-checkbox"]')
            if (stepElement) {
              const textContainer = stepElement.querySelector('.shepherd-text')
              if (textContainer) {
                const indicator = createStepIndicator(2, 3)
                textContainer.insertBefore(indicator, textContainer.firstChild)
              }
            }
          }, 10)
        },
        hide: () => {
          // Cleanup when leaving step 2
          cleanupHighlights()
        }
      }
    })

    // Step 3: Generate Summary
    tourRef.current.addStep({
      id: 'generate-summary',
      title: '',
      text: `3. Click "Generate Summary" to create AI summary`,
      attachTo: {
        element: () => {
          const generateButton = findGenerateButton()
          if (generateButton) {
            addHighlight(generateButton)
            return generateButton
          }
          return document.body
        },
        on: 'top'
      },
      beforeShowPromise: function() {
        return new Promise<void>((resolve) => {
          cleanupHighlights()
          
          // Ensure dropdown is closed
          ensureDropdownClosed()
          
          setTimeout(() => resolve(), 300)
        })
      },
      buttons: [
        {
          text: 'Back',
          action: () => {
            cleanupHighlights()
            
            // When going back from step 3 to step 2, set flag to keep dropdown open
            dropdownShouldBeOpen = true
            
            // Go directly to step 2 (dropdown will be opened in step 2's beforeShowPromise)
            tourRef.current?.show('select-checkbox')
          },
          secondary: true
        },
        {
          text: 'Finish',
          action: () => {
            cleanupHighlights()
            tourRef.current?.complete()
            style.remove()
            if (onComplete) onComplete()
          }
        }
      ],
      when: {
        show: () => {
          setTimeout(() => {
            const stepElement = document.querySelector('.shepherd-step[data-id="generate-summary"]')
            if (stepElement) {
              const textContainer = stepElement.querySelector('.shepherd-text')
              if (textContainer) {
                const indicator = createStepIndicator(3, 3)
                textContainer.insertBefore(indicator, textContainer.firstChild)
              }
            }
          }, 10)
        }
      }
    })

    tourRef.current.on('complete', () => {
      cleanupHighlights()
      style.remove()
      if (onComplete) onComplete()
    })

    tourRef.current.on('cancel', () => {
      cleanupHighlights()
      style.remove()
      if (onComplete) onComplete()
    })

    setTimeout(() => {
      if (tourRef.current) {
        try {
          tourRef.current.start()
        } catch (error) {
          console.error('Failed to start tutorial:', error)
          style.remove()
          if (onComplete) onComplete()
        }
      }
    }, 500) // Give time for modal to fully render

    return () => {
      if (tourRef.current) {
        tourRef.current.complete()
      }
      style.remove()
      cleanupHighlights()
    }
  }

  useEffect(() => {
    return () => {
      if (tourRef.current) {
        tourRef.current.complete()
      }

      document.querySelectorAll('style').forEach(style => {
        if (style.textContent?.includes('shepherd-theme-modern')) {
          style.remove()
        }
      })

      cleanupHighlights()
    }
  }, [])

  return null
}