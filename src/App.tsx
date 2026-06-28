import { useState, useCallback, useRef, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import data from './data.json'
import './App.css'

interface MatchDetail {
  team: string
  opp: string
  score: string
  fullScore: string
  matchNum: number
  stage: string
  pts: number
  breakdown: string[]
  goals: number
  win: number
  draw: number
  ko: number
  etpk: number
}

interface DataPoint {
  x: number
  y: number
  details: MatchDetail[]
}

interface Player {
  name: string
  teams: string[]
  color: string
  totalPoints: number
  gamesPlayed: number
  data: DataPoint[]
  avatarCol: number
  avatarRow: number
}

const players = data.players as Player[]

function Avatar({ player, size = 48 }: { player: Player; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        overflow: 'hidden',
        border: `2px solid ${player.color}`,
        flexShrink: 0,
      }}
    >
      <img
        src={`/avatars/${player.name.toLowerCase()}.png`}
        alt={player.name}
        width={size}
        height={size}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
      />
    </div>
  )
}

interface TooltipState {
  player: Player
  point: DataPoint
  screenX: number
  screenY: number
}

function TooltipCard({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null
  const { player, point } = tooltip
  if (point.details.length === 0) return null

  const totalGained = point.details.reduce((s, d) => s + d.pts, 0)

  return (
    <div className="tooltip-card">
      <div className="tooltip-header">
        <Avatar player={player} size={38} />
        <div style={{ flex: 1 }}>
          <div className="tooltip-player">{player.name}</div>
          <div className="tooltip-total">{point.y} pts total</div>
        </div>
        <div className="tooltip-gained" style={{ color: player.color }}>
          +{totalGained}
        </div>
      </div>
      {point.details.map((d, i) => (
        <div key={i} className="tooltip-match">
          <div className="tooltip-match-row">
            {d.stage === 'Group Finish' ? (
              <span className="tooltip-stage-badge" style={{ background: '#2a3a1a', color: '#aadd77' }}>
                {d.breakdown[0]?.startsWith('1st') ? '🥇' : d.breakdown[0]?.startsWith('2nd') ? '🥈' : '🥉'} Group Finish
              </span>
            ) : (
              <span className="tooltip-stage-badge">{d.stage}</span>
            )}
            <span className="tooltip-score-text">
              {d.stage === 'Group Finish'
                ? <strong>{d.team}</strong>
                : <><strong>{d.team}</strong> {d.score} {d.opp}</>
              }
            </span>
          </div>
          <div className="tooltip-breakdown">
            {d.breakdown.map((b, j) => (
              <span key={j} className="tooltip-badge" style={d.stage === 'Group Finish' ? { background: '#2a3a1a', color: '#aadd77' } : undefined}>{b}</span>
            ))}
            {d.pts === 0 && d.stage !== 'Group Finish' && <span className="tooltip-badge zero">No pts</span>}
          </div>
        </div>
      ))}
      {point.details.every(d => d.stage !== 'Group Finish') && (
        <div className="tooltip-game-label">
          Game {point.x} of {player.gamesPlayed}
        </div>
      )}
    </div>
  )
}

// Build unified recharts data array with each player's step-interpolated y value
function buildChartData(visiblePlayers: Player[]) {
  const maxX = Math.max(...players.map(p => p.gamesPlayed), 1)
  const rows: Record<string, number>[] = []
  for (let x = 0; x <= maxX; x++) {
    const row: Record<string, number> = { x }
    for (const p of visiblePlayers) {
      let val = 0
      for (const pt of p.data) {
        if (pt.x <= x) val = pt.y
        else break
      }
      row[p.name] = val
    }
    rows.push(row)
  }
  return rows
}

// Custom dot renderer: only shows on actual data events
function renderDot(
  props: {
    cx?: number
    cy?: number
    payload?: Record<string, number>
  },
  player: Player,
  hoveredPlayer: string | null,
  onEnter: (tt: TooltipState) => void,
  onLeave: () => void
) {
  const { cx, cy, payload } = props
  if (!cx || !cy || !payload) return <g key="empty" />
  const x = payload['x']
  const pt = player.data.find(d => d.x === x)
  if (!pt || pt.details.length === 0) return <g key={`${player.name}-${x}-empty`} />

  const opacity = hoveredPlayer && hoveredPlayer !== player.name ? 0.2 : 1

  return (
    <circle
      key={`${player.name}-${x}`}
      cx={cx}
      cy={cy}
      r={5}
      fill={player.color}
      stroke="#0f0f1a"
      strokeWidth={2}
      style={{ cursor: 'pointer', opacity }}
      onMouseEnter={(e) => {
        const rect = (e.target as SVGElement)
          .closest('svg')!
          .getBoundingClientRect()
        onEnter({
          player,
          point: pt,
          screenX: rect.left + cx,
          screenY: rect.top + cy,
        })
      }}
      onMouseLeave={onLeave}
    />
  )
}

export default function App() {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const visible = players.filter(p => !hidden.has(p.name))
  const chartData = buildChartData(visible)
  const sorted = [...players].sort((a, b) => b.totalPoints - a.totalPoints)

  const togglePlayer = (name: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
    setTooltip(null)
  }

  const handleEnter = useCallback((tt: TooltipState) => setTooltip(tt), [])
  const handleLeave = useCallback(() => setTooltip(null), [])

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Position tooltip relative to chart wrapper (fixed on mobile to avoid overflow)
  const getTooltipStyle = () => {
    if (!tooltip) return {}
    if (isMobile) {
      return { position: 'fixed' as const, left: 12, right: 12, bottom: 80, top: 'auto' }
    }
    if (!chartRef.current) return {}
    const rect = chartRef.current.getBoundingClientRect()
    let left = tooltip.screenX - rect.left + 12
    let top = tooltip.screenY - rect.top - 80
    if (left + 260 > rect.width) left = tooltip.screenX - rect.left - 272
    if (top < 0) top = 8
    return { left, top }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <span className="trophy">🏆</span>
          <div>
            <h1>World Cup 2026 Pool</h1>
            <p className="subtitle">Track points as games are played · hover dots for match details</p>
          </div>
        </div>
        <div className="standings-row">
          {sorted.map((p, i) => (
            <div key={p.name} className="standing-chip" style={{ borderColor: p.color + '80' }}>
              <span className="chip-rank" style={{ color: p.color }}>#{i + 1}</span>
              <Avatar player={p} size={22} />
              <span className="chip-name">{p.name}</span>
              <span className="chip-pts" style={{ color: p.color }}>{p.totalPoints}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="main-content">
        <div className="legend-panel">
          <div className="legend-title">Players</div>
          {players.map(p => {
            const isHidden = hidden.has(p.name)
            const isDimmed = !!(hoveredPlayer && hoveredPlayer !== p.name)
            return (
              <button
                key={p.name}
                className={`legend-btn ${isHidden ? 'leg-hidden' : ''} ${isDimmed ? 'leg-dimmed' : ''}`}
                style={{ '--col': p.color } as React.CSSProperties}
                onClick={() => togglePlayer(p.name)}
                onMouseEnter={() => setHoveredPlayer(p.name)}
                onMouseLeave={() => setHoveredPlayer(null)}
              >
                <Avatar player={p} size={36} />
                <div className="leg-info">
                  <span className="leg-name">{p.name}</span>
                  <span className="leg-sub">{p.totalPoints} pts · {p.gamesPlayed}g</span>
                </div>
                {isHidden && <span className="leg-x">✕</span>}
              </button>
            )
          })}
        </div>

        <div className="chart-area" ref={chartRef}>
          <ResponsiveContainer width="100%" height={520}>
            <LineChart data={chartData} margin={{ top: 16, right: 32, left: 8, bottom: isMobile ? 48 : 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 'dataMax']}
                tickCount={14}
                label={{
                  value: 'Games Played',
                  position: 'insideBottom',
                  offset: -16,
                  fill: '#666',
                  fontSize: 13,
                }}
                tick={{ fill: '#666', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
              />
              <YAxis
                label={{
                  value: 'Points',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 20,
                  fill: '#666',
                  fontSize: 13,
                }}
                tick={{ fill: '#666', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              {visible.map(p => {
                const isHovered = hoveredPlayer === p.name
                const opacity = hoveredPlayer && !isHovered ? 0.18 : 1
                return (
                  <Line
                    key={p.name}
                    type="stepAfter"
                    dataKey={p.name}
                    stroke={p.color}
                    strokeWidth={isHovered ? 3.5 : 2}
                    strokeOpacity={opacity}
                    dot={(dotProps) =>
                      renderDot(
                        dotProps as { cx?: number; cy?: number; payload?: Record<string, number> },
                        p,
                        hoveredPlayer,
                        handleEnter,
                        handleLeave
                      )
                    }
                    activeDot={false}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>

          {tooltip && (
            <div className="floating-tooltip" style={{ ...getTooltipStyle(), width: isMobile ? 'auto' : undefined }}>
              <TooltipCard tooltip={tooltip} />
            </div>
          )}
        </div>
      </div>

      {!scrolled && (
        <button
          className="scroll-hint"
          onClick={() => document.querySelector('.teams-section')?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Scroll to rosters"
        >
          <span className="scroll-hint-label">Rosters</span>
          <span className="scroll-hint-arrow">↓</span>
        </button>
      )}

      <div className="teams-section">
        <h2 className="teams-title">Rosters</h2>
        <div className="teams-grid">
          {sorted.map(p => (
            <div
              key={p.name}
              className="team-card"
              style={{ borderColor: hidden.has(p.name) ? '#222' : p.color + '44' }}
            >
              <div className="team-card-head">
                <Avatar player={p} size={44} />
                <div>
                  <div className="tc-name">{p.name}</div>
                  <div className="tc-pts" style={{ color: p.color }}>
                    {p.totalPoints} pts · {p.gamesPlayed} games
                  </div>
                </div>
              </div>
              <div className="team-tags">
                {p.teams.map(t => (
                  <span key={t} className="team-tag">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
