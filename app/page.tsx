'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Home() {
  const [data, setData] = useState<any[]>([])
  const [updateInterval, setUpdateInterval] = useState(5)
  const timerRef = useRef<any>(null)
  const [threshold, setThreshold] = useState(2)
  const [alarms, setAlarms] = useState<string[]>([])
  const [reportMinutes, setReportMinutes] = useState(10)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, updateInterval * 1000)
    return () => clearInterval(timerRef.current)
  }, [updateInterval])

  async function fetchData() {
    const { data: rows, error } = await supabase
      .from('accelerometer_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Supabase error:', error)
      return
    }

    if (rows && rows.length > 0) {
      const mapped = rows.reverse().map(row => ({
        time: new Date(row.timestamp).toLocaleTimeString(),
        fullTime: row.timestamp,
        accel_x: parseFloat(row.accel_x),
        accel_y: parseFloat(row.accel_y),
        accel_z: parseFloat(row.accel_z),
        temperature: parseFloat(row.temperature)
      }))
      setData(mapped)
      setLastUpdate(new Date().toLocaleTimeString())
      checkAlarms(mapped, threshold)
    }
  }

  function checkAlarms(rows: any[], t: number) {
    if (rows.length === 0) return
    const latest = rows[rows.length - 1]
    const newAlarms: string[] = []
    const time = new Date().toLocaleTimeString()

    if (Math.abs(latest.accel_x) > t)
      newAlarms.push(`[${time}] ⚠️ Accel X: ${latest.accel_x.toFixed(3)} excedeu threshold (±${t})`)
    if (Math.abs(latest.accel_y) > t)
      newAlarms.push(`[${time}] ⚠️ Accel Y: ${latest.accel_y.toFixed(3)} excedeu threshold (±${t})`)
    if (Math.abs(latest.accel_z) > t)
      newAlarms.push(`[${time}] ⚠️ Accel Z: ${latest.accel_z.toFixed(3)} excedeu threshold (±${t})`)

    if (newAlarms.length > 0) {
      setAlarms(prev => [...newAlarms, ...prev].slice(0, 20))
    }
  }

  function generateReport(minutes: number) {
    if (data.length === 0) {
      alert('Sem dados disponíveis!')
      return
    }

    const now = Date.now()
    const cutoff = now - minutes * 60 * 1000
    const filtered = data.filter(d => new Date(d.fullTime).getTime() >= cutoff)
    const useData = filtered.length > 0 ? filtered : data

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const max = (arr: number[]) => Math.max(...arr)
    const min = (arr: number[]) => Math.min(...arr)

    const xs = useData.map(d => d.accel_x)
    const ys = useData.map(d => d.accel_y)
    const zs = useData.map(d => d.accel_z)
    const temps = useData.map(d => d.temperature)

    const report = `UR5 Accelerometer Report
========================
Gerado em: ${new Date().toLocaleString()}
Intervalo: últimos ${minutes} minutos
Total de leituras: ${useData.length}

ACCEL X:
  Média:   ${avg(xs).toFixed(4)}
  Máximo:  ${max(xs).toFixed(4)}
  Mínimo:  ${min(xs).toFixed(4)}

ACCEL Y:
  Média:   ${avg(ys).toFixed(4)}
  Máximo:  ${max(ys).toFixed(4)}
  Mínimo:  ${min(ys).toFixed(4)}

ACCEL Z:
  Média:   ${avg(zs).toFixed(4)}
  Máximo:  ${max(zs).toFixed(4)}
  Mínimo:  ${min(zs).toFixed(4)}

TEMPERATURA:
  Média:   ${avg(temps).toFixed(2)}°C
  Máximo:  ${max(temps).toFixed(2)}°C
  Mínimo:  ${min(temps).toFixed(2)}°C
`
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${minutes}min_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = (arr: number[]) => ({
    avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3),
    max: Math.max(...arr).toFixed(3),
    min: Math.min(...arr).toFixed(3),
  })

  return (
    <main className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🤖 UR5 Accelerometer Dashboard</h1>
        <div className="text-gray-400 text-sm">
          {lastUpdate && `Última atualização: ${lastUpdate}`}
          <span className="ml-2 inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        </div>
      </div>

      {/* Intervalo de atualização */}
      <div className="mb-6 bg-gray-800 p-4 rounded-lg flex items-center gap-4">
        <span className="text-lg font-semibold">⏱️ Intervalo de atualização:</span>
        <input
          type="range" min="1" max="30" value={updateInterval}
          onChange={(e) => setUpdateInterval(Number(e.target.value))}
          className="w-48"
        />
        <span className="text-blue-400 font-bold text-xl">{updateInterval}s</span>
      </div>

      {/* Cards com últimos valores */}
      {data.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '📡 Accel X', value: data[data.length-1].accel_x.toFixed(3), color: 'text-blue-400' },
            { label: '📡 Accel Y', value: data[data.length-1].accel_y.toFixed(3), color: 'text-green-400' },
            { label: '📡 Accel Z', value: data[data.length-1].accel_z.toFixed(3), color: 'text-red-400' },
            { label: '🌡️ Temperatura', value: `${data[data.length-1].temperature?.toFixed(1)}°C`, color: 'text-yellow-400' },
          ].map((item) => (
            <div key={item.label} className="bg-gray-800 p-4 rounded-lg text-center border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Estatísticas */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Accel X', values: data.map(d => d.accel_x), color: 'border-blue-500' },
            { label: 'Accel Y', values: data.map(d => d.accel_y), color: 'border-green-500' },
            { label: 'Accel Z', values: data.map(d => d.accel_z), color: 'border-red-500' },
          ].map(({ label, values, color }) => {
            const s = stats(values)
            return (
              <div key={label} className={`bg-gray-800 p-4 rounded-lg border-l-4 ${color}`}>
                <h3 className="font-semibold mb-2">{label} — Estatísticas</h3>
                <p className="text-sm text-gray-300">Média: <span className="text-white font-mono">{s.avg}</span></p>
                <p className="text-sm text-gray-300">Máximo: <span className="text-white font-mono">{s.max}</span></p>
                <p className="text-sm text-gray-300">Mínimo: <span className="text-white font-mono">{s.min}</span></p>
              </div>
            )
          })}
        </div>
      )}

      {/* Gráfico Accel X */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h2 className="text-lg font-semibold mb-2 text-blue-400">📈 Accel X</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 9 }} />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
            <Line type="monotone" dataKey="accel_x" stroke="#60A5FA" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico Accel Y */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h2 className="text-lg font-semibold mb-2 text-green-400">📈 Accel Y</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 9 }} />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
            <Line type="monotone" dataKey="accel_y" stroke="#34D399" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico Accel Z */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2 text-red-400">📈 Accel Z</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 9 }} />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
            <Line type="monotone" dataKey="accel_z" stroke="#F87171" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Relatório */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">📊 Gerar Relatório</h2>
        <div className="flex items-center gap-4">
          <select
            value={reportMinutes}
            onChange={(e) => setReportMinutes(Number(e.target.value))}
            className="bg-gray-700 text-white px-3 py-2 rounded"
          >
            <option value={10}>Últimos 10 min</option>
            <option value={30}>Últimos 30 min</option>
            <option value={60}>Últimos 60 min</option>
          </select>
          <button
            onClick={() => generateReport(reportMinutes)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
          >
            ⬇️ Download Relatório
          </button>
        </div>
      </div>

      {/* Alarmes */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🚨 Alarmes</h2>
        <div className="flex items-center gap-4 mb-4">
          <label>Threshold (±):</label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="bg-gray-700 text-white px-3 py-1 rounded w-24"
          />
          <button
            onClick={() => setAlarms([])}
            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
          >
            Limpar
          </button>
        </div>
        {alarms.length === 0 ? (
          <p className="text-green-400">✅ Sem alarmes activos</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {alarms.map((alarm, i) => (
              <li key={i} className="text-red-400 bg-red-900/20 p-2 rounded text-sm font-mono">{alarm}</li>
            ))}
          </ul>
        )}
      </div>

    </main>
  )
}