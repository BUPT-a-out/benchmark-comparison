import React, { useState, useEffect, useMemo } from 'react'
import Select, { components } from 'react-select'
import axios from 'axios'

type SortKey = 'id' | 'baseTime' | 'rightTime' | 'absoluteChange' | 'relativeChange' | 'leftScore' | 'rightScore'
type SortDirection = 'asc' | 'desc'

interface BenchmarkResult {
  id: number
  name: string
  runtime: number
  best_time: number
  score: number
  status: string
}

interface CommitData {
  sha: string
  message: string
  author: string
  author_email: string
  date: string
  url: string
  parent_sha: string | null
  average_score: number
  benchmarks: BenchmarkResult[]
}

interface BenchmarkData {
  commits: CommitData[]
  best_times: Record<string, { id: number; best_time: number }>
  generated_at: string
}

// 配置常量
const NEUTRAL_CHANGE_THRESHOLD = 2 // 百分比阈值，认为变化不大的范围（±2%）
const SCORE_CHANGE_THRESHOLD = 0.5 // 分数变化阈值

// 计算相对时间
function getRelativeTime(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffYears > 0) {
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
  } else if (diffMonths > 0) {
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  } else if (diffWeeks > 0) {
    return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  } else {
    return 'just now'
  }
}

function App() {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftCommit, setLeftCommit] = useState<CommitData | null>(null)
  const [rightCommit, setRightCommit] = useState<CommitData | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [hoveredColumn, setHoveredColumn] = useState<SortKey | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  // 从URL参数获取commit hash
  useEffect(() => {
    if (!data) return
    
    const urlParams = new URLSearchParams(window.location.search)
    const leftSha = urlParams.get('left')
    const rightSha = urlParams.get('right')
    
    if (leftSha && !leftCommit) {
      const commit = data.commits.find(c => c.sha.startsWith(leftSha))
      if (commit) {
        setLeftCommit(commit)
      }
    }
    
    if (rightSha && !rightCommit) {
      const commit = data.commits.find(c => c.sha.startsWith(rightSha))
      if (commit) {
        setRightCommit(commit)
      }
    }
  }, [data, leftCommit, rightCommit])

  // 更新URL参数
  const updateUrlParams = (left: CommitData | null, right: CommitData | null) => {
    const url = new URL(window.location.href)
    
    if (left) {
      url.searchParams.set('left', left.sha.substring(0, 7))
    } else {
      url.searchParams.delete('left')
    }
    
    if (right) {
      url.searchParams.set('right', right.sha.substring(0, 7))
    } else {
      url.searchParams.delete('right')
    }
    
    window.history.replaceState({}, '', url.toString())
  }

  const fetchData = async () => {
    try {
      const response = await axios.get('./data/benchmark_data.json')
      setData(response.data)
      setLoading(false)
    } catch (err) {
      setError('Failed to load benchmark data')
      setLoading(false)
    }
  }

  // 自定义 Option 组件
  const CustomOption = (props: any) => {
    const commit = props.data.value
    const isFocused = props.isFocused
    const isSelected = props.isSelected
    
    return (
      <components.Option {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="option-sha">
            {commit.sha.substring(0, 7)}
          </span>
          <span style={{ 
            backgroundColor: commit.average_score > 50 ? '#1a7f37' : commit.average_score > 40 ? '#fb8500' : '#d1242f',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            {commit.average_score.toFixed(1)}
          </span>
          <span className="option-time">
            {getRelativeTime(commit.date)}
          </span>
          <span className="option-message">
            {commit.message.split('\n')[0]}
          </span>
        </div>
      </components.Option>
    )
  }

  const commitOptions = useMemo(() => {
    if (!data) return []
    return data.commits.map(commit => ({
      value: commit,
      label: `${commit.sha.substring(0, 7)} • ${commit.average_score.toFixed(1)} pts • ${getRelativeTime(commit.date)} • ${commit.message.split('\n')[0].substring(0, 40)}${commit.message.split('\n')[0].length > 40 ? '...' : ''}`
    }))
  }, [data])

  const leftOptions = useMemo(() => {
    if (!rightCommit) return commitOptions
    const rightDate = new Date(rightCommit.date)
    return commitOptions.filter(opt => new Date(opt.value.date) < rightDate)
  }, [commitOptions, rightCommit])

  const rightOptions = useMemo(() => {
    if (!leftCommit) return commitOptions
    const leftDate = new Date(leftCommit.date)
    return commitOptions.filter(opt => new Date(opt.value.date) > leftDate)
  }, [commitOptions, leftCommit])

  const comparison = useMemo(() => {
    if (!leftCommit || !rightCommit) return null

    const leftBenchmarks = new Map(leftCommit.benchmarks.map(b => [b.name, b]))
    const rightBenchmarks = new Map(rightCommit.benchmarks.map(b => [b.name, b]))
    
    const results = []
    let totalRelativeChange = 0
    let count = 0

    for (const [name, leftBench] of leftBenchmarks) {
      const rightBench = rightBenchmarks.get(name)
      if (rightBench) {
        const absoluteChange = rightBench.runtime - leftBench.runtime
        const relativeChange = ((rightBench.runtime - leftBench.runtime) / leftBench.runtime) * 100
        
        totalRelativeChange += relativeChange
        count++

        results.push({
          id: leftBench.id,
          name,
          bestTime: leftBench.best_time,
          leftTime: leftBench.runtime,
          rightTime: rightBench.runtime,
          absoluteChange,
          relativeChange,
          leftScore: leftBench.score,
          rightScore: rightBench.score
        })
      }
    }

    const avgRelativeChange = count > 0 ? totalRelativeChange / count : 0

    // Sort results based on current sort settings
    const sortedResults = [...results].sort((a, b) => {
      let comparison = 0
      
      switch (sortKey) {
        case 'id':
          comparison = a.id - b.id
          break
        case 'baseTime':
          comparison = a.leftTime - b.leftTime
          break
        case 'rightTime':
          comparison = a.rightTime - b.rightTime
          break
        case 'absoluteChange':
          comparison = a.absoluteChange - b.absoluteChange
          break
        case 'relativeChange':
          comparison = a.relativeChange - b.relativeChange
          break
        case 'leftScore':
          comparison = a.leftScore - b.leftScore
          break
        case 'rightScore':
          comparison = a.rightScore - b.rightScore
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return {
      results: sortedResults,
      avgRelativeChange
    }
  }, [leftCommit, rightCommit, sortKey, sortDirection])

  const getChangeClass = (change: number) => {
    if (Math.abs(change) <= NEUTRAL_CHANGE_THRESHOLD) return 'neutral'
    return change < 0 ? 'positive' : 'negative'
  }

  const getScoreChangeClass = (oldScore: number, newScore: number) => {
    const change = newScore - oldScore
    if (Math.abs(change) < SCORE_CHANGE_THRESHOLD) return 'neutral'
    return change > 0 ? 'positive' : 'negative'
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (key: SortKey) => {
    // 只在当前排序列或 hover 时显示图标
    if (sortKey === key) {
      return sortDirection === 'asc' ? '↑' : '↓'
    }
    if (hoveredColumn === key) {
      return '↕'
    }
    return <span style={{ opacity: 0 }}>↕</span> // 占位符，保持宽度
  }

  if (loading) {
    return <div className="container"><div className="loading">Loading benchmark data...</div></div>
  }

  if (error) {
    return <div className="container"><div className="error">{error}</div></div>
  }

  if (!data) {
    return <div className="container"><div className="no-data">No benchmark data available</div></div>
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Benchmark Comparison</h1>
        <p>Compare performance between different compiler commits</p>
      </div>

      <div className="commit-selector">
        <div className="commit-selector-item">
          <label>Base Commit (Earlier)</label>
          <Select
            className="react-select"
            classNamePrefix="react-select"
            options={leftOptions}
            value={leftCommit ? leftOptions.find(opt => opt.value.sha === leftCommit.sha) : null}
            onChange={(option) => {
              const newLeft = option?.value || null
              setLeftCommit(newLeft)
              updateUrlParams(newLeft, rightCommit)
            }}
            placeholder="Select base commit..."
            isClearable
            components={{ Option: CustomOption }}
          />
        </div>
        <div className="commit-selector-item">
          <label>Compare Commit (Later)</label>
          <Select
            className="react-select"
            classNamePrefix="react-select"
            options={rightOptions}
            value={rightCommit ? rightOptions.find(opt => opt.value.sha === rightCommit.sha) : null}
            onChange={(option) => {
              const newRight = option?.value || null
              setRightCommit(newRight)
              updateUrlParams(leftCommit, newRight)
            }}
            placeholder="Select compare commit..."
            isClearable
            components={{ Option: CustomOption }}
          />
        </div>
      </div>

      {leftCommit && rightCommit && (
        <>
          <div className="commit-info">
            <div className="commit-card">
              <h3>
                Base Commit
                <span className="commit-sha">{leftCommit.sha.substring(0, 7)}</span>
              </h3>
              <div className="commit-message">{leftCommit.message.split('\n')[0]}</div>
              <div className="commit-meta">
                <div>Author: {leftCommit.author}</div>
                <div>Date: {new Date(leftCommit.date).toLocaleString()}</div>
              </div>
              <a href={leftCommit.url} target="_blank" rel="noopener noreferrer" className="commit-link">
                View on GitHub →
              </a>
            </div>
            <div className="commit-card">
              <h3>
                Compare Commit
                <span className="commit-sha">{rightCommit.sha.substring(0, 7)}</span>
              </h3>
              <div className="commit-message">{rightCommit.message.split('\n')[0]}</div>
              <div className="commit-meta">
                <div>Author: {rightCommit.author}</div>
                <div>Date: {new Date(rightCommit.date).toLocaleString()}</div>
              </div>
              <a href={rightCommit.url} target="_blank" rel="noopener noreferrer" className="commit-link">
                View on GitHub →
              </a>
            </div>
          </div>

          <div className="score-comparison">
            <div className="score-card">
              <h4>Base Score</h4>
              <div className="score-value">{leftCommit.average_score.toFixed(2)}</div>
            </div>
            <div className="score-card">
              <h4>Compare Score</h4>
              <div className={`score-value ${getScoreChangeClass(leftCommit.average_score, rightCommit.average_score)}`}>
                {rightCommit.average_score.toFixed(2)}
              </div>
              <div className={`score-change ${getScoreChangeClass(leftCommit.average_score, rightCommit.average_score)}`}>
                {((rightCommit.average_score - leftCommit.average_score) / leftCommit.average_score * 100).toFixed(2)}%
              </div>
            </div>
            <div className="score-card">
              <h4>Performance Change</h4>
              <div className={`score-value ${comparison ? getChangeClass(comparison.avgRelativeChange) : 'neutral'}`}>
                {comparison ? `${comparison.avgRelativeChange > 0 ? '+' : ''}${comparison.avgRelativeChange.toFixed(2)}%` : '—'}
              </div>
              <div className="score-change neutral">Average runtime change</div>
            </div>
          </div>

          {comparison && (
            <div className="table-container">
              <div className="table-header">
                <h2>Benchmark Details</h2>
                <div className="threshold-info">
                  Changes within ±{NEUTRAL_CHANGE_THRESHOLD}% are considered neutral
                </div>
              </div>
              <table className="benchmark-table">
                <thead>
                  <tr>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('id')}
                      onMouseEnter={() => setHoveredColumn('id')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      ID <span className="sort-icon">{getSortIcon('id')}</span>
                    </th>
                    <th>Test Case</th>
                    <th>Best Time (s)</th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('baseTime')}
                      onMouseEnter={() => setHoveredColumn('baseTime')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      Base Time (s) <span className="sort-icon">{getSortIcon('baseTime')}</span>
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('rightTime')}
                      onMouseEnter={() => setHoveredColumn('rightTime')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      Compare Time (s) <span className="sort-icon">{getSortIcon('rightTime')}</span>
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('absoluteChange')}
                      onMouseEnter={() => setHoveredColumn('absoluteChange')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      Change (s) <span className="sort-icon">{getSortIcon('absoluteChange')}</span>
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('relativeChange')}
                      onMouseEnter={() => setHoveredColumn('relativeChange')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      Change (%) <span className="sort-icon">{getSortIcon('relativeChange')}</span>
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('leftScore')}
                      onMouseEnter={() => setHoveredColumn('leftScore')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      Base Score <span className="sort-icon">{getSortIcon('leftScore')}</span>
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('rightScore')}
                      onMouseEnter={() => setHoveredColumn('rightScore')}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      Compare Score <span className="sort-icon">{getSortIcon('rightScore')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.results.map(result => {
                    const scoreChange = result.rightScore - result.leftScore
                    const rowClass = Math.abs(scoreChange) > SCORE_CHANGE_THRESHOLD 
                      ? (scoreChange > 0 ? 'row-improved' : 'row-degraded')
                      : ''
                    
                    return (
                      <tr key={result.id} className={rowClass}>
                        <td>{result.id}</td>
                        <td>{result.name}</td>
                        <td>{result.bestTime.toFixed(4)}</td>
                        <td>{result.leftTime.toFixed(4)}</td>
                        <td>{result.rightTime.toFixed(4)}</td>
                        <td className={getChangeClass(result.relativeChange)}>
                          {result.absoluteChange > 0 ? '+' : ''}{result.absoluteChange.toFixed(4)}
                        </td>
                        <td className={getChangeClass(result.relativeChange)}>
                          {result.relativeChange > 0 ? '+' : ''}{result.relativeChange.toFixed(2)}%
                        </td>
                        <td>{result.leftScore.toFixed(2)}</td>
                        <td className={getScoreChangeClass(result.leftScore, result.rightScore)}>
                          {result.rightScore.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App