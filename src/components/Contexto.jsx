import React from 'react'
import Icono from './Icono.jsx'
import { TONOS } from '../rubros.js'

// Barra de ubicación: Inicio › Dirección › Rubro, con el tono e ícono del rubro
// (los mismos que en el inicio), para saber siempre en qué subdirección se está.
export default function Contexto({ direccion, rubro, onNavigate }) {
  const t = rubro.tipo === 'subdireccion'
    ? (TONOS[rubro.tono] || TONOS.gris)
    : { acento: '#454247', fondo: '#EDEAE6', icono: '#454247', trazo: '#FFFFFF' }

  return (
    <nav aria-label="Ubicación"
      className="mb-4 rounded-lg px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-shrink-0"
      style={{
        background: `linear-gradient(90deg, ${t.fondo} 0%, #FFFFFF 80%)`,
        borderLeft: `4px solid ${t.acento}`,
        boxShadow: '0 1px 4px rgba(69,66,71,.10)',
      }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: t.icono }}>
        <Icono nombre={rubro.icono} color={t.trazo} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-x-1.5 text-xs text-ine-muted">
          <li><button onClick={() => onNavigate('inicio')} className="hover:underline">Inicio</button></li>
          <li aria-hidden="true">›</li>
          <li className="truncate">Dirección de {direccion.label}</li>
        </ol>
        <p className="text-sm font-bold text-ine-text leading-tight mt-0.5 truncate" aria-current="page">
          {rubro.tipo === 'subdireccion' ? rubro.label : `${rubro.label} · ${direccion.label}`}
        </p>
      </div>
      <span className="hidden sm:inline-block px-2 py-1 rounded text-xs font-black flex-shrink-0"
        style={{ background: direccion.tema.fondo, color: direccion.tema.texto }}>
        {direccion.corto}
      </span>
    </nav>
  )
}
