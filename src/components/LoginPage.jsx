import { useEffect } from 'react'
import { irAlPortal } from '../sesion.js'

// Sin sesión: al portal a iniciar sesión; después regresa a esta pantalla
export default function LoginPage() {
  useEffect(() => { irAlPortal() }, [])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', color:'#454247', fontSize:14 }}>
      Redirigiendo al portal…
    </div>
  )
}
