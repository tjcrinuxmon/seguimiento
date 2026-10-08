import { useEffect } from 'react'

export default function LoginPage() {
  useEffect(() => {
    const base = import.meta.env.VITE_PORTAL_URL || window.location.origin.replace(/:(3009|5176)$/, ':3000')
    window.location.replace(base)
  }, [])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', color:'#454247', fontSize:14 }}>
      Redirigiendo al portal…
    </div>
  )
}
