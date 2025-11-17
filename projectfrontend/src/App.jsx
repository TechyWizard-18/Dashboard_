import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { QrCode, Package, Filter, TrendingUp, RefreshCw, Search, X } from 'lucide-react';
import './index.css';

const API_BASE_URL = 'http://localhost:5001/api/analytics';

function App() {
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchSerialNumber, setSearchSerialNumber] = useState('');
  const [searchStateId, setSearchStateId] = useState('all');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  // Data states
  const [stats, setStats] = useState({
    totalQRCodes: 0,
    totalBatches: 0,
    qrPercentageChange: 0,
    batchPercentageChange: 0
  });
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [locationData, setLocationData] = useState([]);
  const [recentBatches, setRecentBatches] = useState([]);
  const [states, setStates] = useState(['All States']);
  const [districts, setDistricts] = useState(['All Districts']);

  const barColors = ['#00F5FF', '#00FFA3', '#A020F0', '#FF00FF', '#00D9FF', '#7CFC00'];

  // Fetch all states
  useEffect(() => {
    fetch(`${API_BASE_URL}/states`)
      .then(res => res.json())
      .then(data => setStates(['All States', ...data]))
      .catch(err => console.error('Error fetching states:', err));
  }, []);

  // Fetch districts when state changes
  useEffect(() => {
    if (selectedState !== 'All States') {
      fetch(`${API_BASE_URL}/districts?state=${encodeURIComponent(selectedState)}`)
        .then(res => res.json())
        .then(data => setDistricts(['All Districts', ...data]))
        .catch(err => console.error('Error fetching districts:', err));
    } else {
      setDistricts(['All Districts']);
    }
    setSelectedDistrict('All Districts');
  }, [selectedState]);

  // Fetch all data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const queryParams = new URLSearchParams();
      if (selectedState !== 'All States') queryParams.append('state', selectedState);
      if (selectedDistrict !== 'All Districts') queryParams.append('district', selectedDistrict);

      const queryString = queryParams.toString();

      const [statsRes, timeSeriesRes, locationRes, batchesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/stats?${queryString}`),
        fetch(`${API_BASE_URL}/timeseries?${queryString}`),
        fetch(`${API_BASE_URL}/by-location?${queryString}`),
        fetch(`${API_BASE_URL}/recent-batches?${queryString}`)
      ]);

      const [statsData, timeSeriesData, locationData, batchesData] = await Promise.all([
        statsRes.json(),
        timeSeriesRes.json(),
        locationRes.json(),
        batchesRes.json()
      ]);

      setStats(statsData);
      setTimeSeriesData(timeSeriesData);
      setLocationData(locationData);
      setRecentBatches(batchesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [selectedState, selectedDistrict]);


  // Search QR code function
  const handleSearchQR = async () => {
    if (!searchSerialNumber.trim()) {
      alert('Please enter a serial number');
      return;
    }

    setSearching(true);
    setSearchResult(null);

    try {
      const params = new URLSearchParams({
        serialNumber: searchSerialNumber.trim()
      });

      if (searchStateId && searchStateId !== 'all') {
        params.append('stateId', searchStateId);
      }

      const response = await fetch(`${API_BASE_URL}/search-qr?${params}`);
      const data = await response.json();

      setSearchResult(data);
    } catch (error) {
      console.error('Error searching QR:', error);
      setSearchResult({
        found: false,
        error: 'Failed to search. Please try again.'
      });
    } finally {
      setSearching(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{label}</p>
          <p className="value">{`${payload[0].value.toLocaleString()} codes`}</p>
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{payload[0].payload.state}</p>
          <p className="value">{`${payload[0].value.toLocaleString()} codes`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <QrCode className="header-icon" size={32} />
            <h1>QR Analytics Dashboard</h1>
          </div>
          <div className="header-actions">
            <button
              className="search-button"
              onClick={() => setShowSearchModal(true)}
              title="Search QR Code"
            >
              <Search size={18} />
              Search QR
            </button>
            <button
              className="refresh-button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? 'spinning' : ''} size={18} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="header-time">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Top Row: KPI Cards and Filters */}
        <div className="top-row">
          {/* KPI Cards */}
          <div className="kpi-section">
            <div className="kpi-card kpi-card-primary">
              <div className="kpi-icon-wrapper primary-glow">
                <QrCode className="kpi-icon" size={28} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total QR Codes Generated</div>
                <div className="kpi-value">
                  <span className="kpi-number">{stats.totalQRCodes.toLocaleString()}</span>
                  <span className={`kpi-trend ${parseFloat(stats.qrPercentageChange) >= 0 ? 'positive' : 'negative'}`}>
                    <TrendingUp size={16} />
                    {stats.qrPercentageChange > 0 ? '+' : ''}{stats.qrPercentageChange}%
                  </span>
                </div>
                <div className="kpi-subtitle">Last 30 days</div>
              </div>
            </div>

            <div className="kpi-card kpi-card-secondary">
              <div className="kpi-icon-wrapper secondary-glow">
                <Package className="kpi-icon" size={28} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Batches Created</div>
                <div className="kpi-value">
                  <span className="kpi-number">{stats.totalBatches.toLocaleString()}</span>
                  <span className={`kpi-trend ${parseFloat(stats.batchPercentageChange) >= 0 ? 'positive' : 'negative'}`}>
                    <TrendingUp size={16} />
                    {stats.batchPercentageChange > 0 ? '+' : ''}{stats.batchPercentageChange}%
                  </span>
                </div>
                <div className="kpi-subtitle">Last 30 days</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section">
            <div className="filters-header">
              <Filter className="filter-icon" size={20} />
              <span>Filter Data</span>
            </div>
            <div className="filters-wrapper">
              <div className="filter-group">
                <label>State</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="filter-select"
                >
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>District</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="filter-select"
                  disabled={selectedState === 'All States'}
                >
                  {districts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chart - QR Generation Over Time */}
        <div className="chart-container wave-chart">
          <div className="chart-header">
            <h2>QR Generation Over Time</h2>
            <div className="chart-subtitle">Daily generation volume with trend analysis</div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorCodes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#00F5FF" stopOpacity={0}/>
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="codes"
                stroke="#00F5FF"
                strokeWidth={3}
                fill="url(#colorCodes)"
                filter="url(#glow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom Row: Bar Chart and Recent Batches */}
        <div className="bottom-row">
          {/* Bar Chart - Codes by Location */}
          <div className="chart-container bar-chart">
            <div className="chart-header">
              <h2>Codes by Location</h2>
              <div className="chart-subtitle">State-wise distribution</div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={locationData}>
                <defs>
                  {barColors.map((color, index) => (
                    <linearGradient key={index} id={`barGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                      <stop offset="100%" stopColor={color} stopOpacity={0.4}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="state"
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="codes" radius={[8, 8, 0, 0]}>
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#barGradient${index % barColors.length})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Batches Table */}
          <div className="chart-container batches-table">
            <div className="chart-header">
              <h2>Recent Batches</h2>
              <div className="chart-subtitle">Latest QR batch generations</div>
            </div>
            <div className="table-wrapper">
              {recentBatches.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>State</th>
                      <th>Brand</th>
                      <th>QR Count</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBatches.map((batch, index) => (
                      <tr key={batch.id} style={{ animationDelay: `${index * 0.05}s` }}>
                        <td className="batch-id">#{batch.id}</td>
                        <td>{batch.state || 'N/A'} {batch.stateCode ? `(${batch.stateCode})` : ''}</td>
                        <td>{batch.brand || 'N/A'}</td>
                        <td className="qr-count">{batch.qrCount || 0}</td>
                        <td className="time-ago">{batch.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data">No batches found for the selected filters</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search QR Modal */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Search QR Code</h2>
              <button className="modal-close" onClick={() => setShowSearchModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="search-form">
                <div className="form-group">
                  <label>Serial Number *</label>
                  <input
                    type="text"
                    placeholder="Enter QR serial number (e.g., NCRJ000000000001)"
                    value={searchSerialNumber}
                    onChange={(e) => setSearchSerialNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !searching && handleSearchQR()}
                    className="search-input"
                    disabled={searching}
                  />
                </div>

                <div className="form-group">
                  <label>State (Optional - helps speed up search)</label>
                  <select
                    value={searchStateId}
                    onChange={(e) => setSearchStateId(e.target.value)}
                    className="search-select"
                    disabled={searching}
                  >
                    <option value="all">All States</option>
                    <option value="1">Rajasthan</option>
                    <option value="2">Maharashtra</option>
                    <option value="3">Gujarat</option>
                    <option value="4">Karnataka</option>
                    <option value="5">Uttar Pradesh</option>
                  </select>
                </div>

                <button
                  className="search-submit-button"
                  onClick={handleSearchQR}
                  disabled={searching || !searchSerialNumber.trim()}
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Search Results */}
              {searchResult && (
                <div className={`search-result ${searchResult.found ? 'found' : 'not-found'}`}>
                  {searchResult.found ? (
                    <>
                      <div className="result-header">
                        <div className="result-status success">
                          <QrCode size={24} />
                          <span>QR Code Found!</span>
                        </div>
                        <div className="result-time">Search time: {searchResult.searchTime}</div>
                      </div>

                      <div className="result-details">
                        <div className="detail-row">
                          <span className="detail-label">Serial Number:</span>
                          <span className="detail-value">{searchResult.data.serialNumber}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">QR Code:</span>
                          <span className="detail-value code">{searchResult.data.code}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">State:</span>
                          <span className="detail-value">{searchResult.data.state.name} ({searchResult.data.state.code})</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Brand:</span>
                          <span className="detail-value">{searchResult.data.brand.name || 'N/A'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Batch Code:</span>
                          <span className="detail-value">{searchResult.data.batch.code}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Batch Total Codes:</span>
                          <span className="detail-value">{searchResult.data.batch.totalCodes?.toLocaleString()}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Created At:</span>
                          <span className="detail-value">{new Date(searchResult.data.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="result-header">
                        <div className="result-status error">
                          <X size={24} />
                          <span>QR Code Not Found</span>
                        </div>
                        {searchResult.searchTime && (
                          <div className="result-time">Search time: {searchResult.searchTime}</div>
                        )}
                      </div>
                      <div className="result-message">
                        {searchResult.error || searchResult.message || 'No QR code found with this serial number.'}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

