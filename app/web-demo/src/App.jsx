import React, { useMemo, useRef, useState, useEffect } from 'react'
import SeeRightApp from './components/SeeRightApp.jsx'

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 16 }}>
      <h1 style={{ margin: '0 0 12px 0' }}>SeeRight Web Demo</h1>
      <SeeRightApp />
    </div>
  )
}
