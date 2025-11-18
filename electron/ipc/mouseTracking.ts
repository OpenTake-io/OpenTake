// uiohook-napi [WIP: scoping out mouse tracking with cross platform support for potential auto zoom/ post processing cursor effects]
// not currently being used.

import { uIOhook } from 'uiohook-napi'

let isMouseTrackingActive = false
let isHookStarted = false
let recordingStartTime: number = 0
let mouseEventData: MouseEvent[] = []

export interface MouseEvent {
  type: 'move' | 'down' | 'up' | 'click'
  timestamp: number // milliseconds since recording started
  x: number
  y: number
  button?: unknown
  clicks?: number
}

export interface MouseTrackingSession {
  startTime: number
  events: MouseEvent[]
  duration: number
}

export function startMouseTracking() {
  if (isMouseTrackingActive) {
    return { success: false, message: 'Already tracking' }
  }

  isMouseTrackingActive = true
  
  // Reset data for new recording session
  recordingStartTime = performance.now()
  mouseEventData = []

  // Only start the hook once
  if (!isHookStarted) {
    setupMouseEventListeners()
    
    try {
      uIOhook.start()
      isHookStarted = true
      return { success: true, message: 'Mouse tracking started', startTime: recordingStartTime }
    } catch (error) {
      console.error('Failed to start mouse tracking:', error)
      isMouseTrackingActive = false
      return { success: false, message: 'Failed to start hook', error }
    }
  } else {
    return { success: true, message: 'Mouse tracking resumed', startTime: recordingStartTime }
  }
}

export function stopMouseTracking(): { success: boolean; message: string; data?: MouseTrackingSession } {
  if (!isMouseTrackingActive) {
    return { success: false, message: 'Not currently tracking' }
  }

  isMouseTrackingActive = false
  
  const duration = performance.now() - recordingStartTime
  
  const session: MouseTrackingSession = {
    startTime: recordingStartTime,
    events: mouseEventData,
    duration: duration
  }
  
  return { 
    success: true, 
    message: 'Mouse tracking stopped',
    data: session
  }
}

function setupMouseEventListeners() {
  // Track mouse movement
  uIOhook.on('mousemove', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'move',
        timestamp,
        x: e.x,
        y: e.y
      }
      mouseEventData.push(event)
    }
  })

  // Track mouse button press
  uIOhook.on('mousedown', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'down',
        timestamp,
        x: e.x,
        y: e.y,
        button: e.button,
        clicks: e.clicks
      }
      mouseEventData.push(event)
    }
  })

  // Track mouse button release
  uIOhook.on('mouseup', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'up',
        timestamp,
        x: e.x,
        y: e.y,
        button: e.button
      }
      mouseEventData.push(event)
    }
  })

  // Track complete click events
  uIOhook.on('click', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'click',
        timestamp,
        x: e.x,
        y: e.y,
        button: e.button,
        clicks: e.clicks
      }
      mouseEventData.push(event)
    }
  })
}

export function getTrackingData(): MouseEvent[] {
  return [...mouseEventData]
}

export function cleanupMouseTracking() {
  if (isHookStarted) {
    try {
      uIOhook.stop()
      isHookStarted = false
      isMouseTrackingActive = false
      mouseEventData = []
    } catch (error) {
      console.error('Error cleaning up mouse tracking:', error)
    }
  }
}
