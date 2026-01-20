import { useState, useEffect } from 'react'
import { 
  Plus, 
  Monitor, 
  Search, 
  Filter,
  Grid,
  List,
  CheckCircle,
  X,
  Smartphone
} from 'lucide-react'
import { Header, DeviceCard, Modal, EmptyState } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { sendDeviceCommand, approveDevice, getRates } from '@/lib/supabase'
import { formatBytes, getStatusBadge, formatRelativeTime } from '@/lib/utils'
import type { Device, Rate } from '@/types'

export function DevicesPage() {
  const { 
    devices, 
    pendingDevices, 
    branches, 
    staff,
    activeSessions,
    fetchDevices, 
    fetchPendingDevices,
    addToast 
  } = useAppStore()
  
  // Helper to find active session for a device
  const getActiveSessionForDevice = (deviceId: string) => {
    return activeSessions.find(s => s.device_id === deviceId && s.status === 'active')
  }
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAdminUnlockModal, setShowAdminUnlockModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedRate, setSelectedRate] = useState('')
  const [branchRates, setBranchRates] = useState<Rate[]>([])
  const [deviceName, setDeviceName] = useState('')
  const [message, setMessage] = useState('')
  const [unlockDuration, setUnlockDuration] = useState('0') // 0 = unlimited
  const [isLoading, setIsLoading] = useState(false)
  
  useEffect(() => {
    fetchDevices()
    fetchPendingDevices()
  }, [])
  
  useEffect(() => {
    if (selectedBranch) {
      loadBranchRates(selectedBranch)
    }
  }, [selectedBranch])
  
  const loadBranchRates = async (branchId: string) => {
    const rates = await getRates(branchId)
    setBranchRates(rates)
    if (rates.length > 0) {
      const defaultRate = rates.find(r => r.is_default) || rates[0]
      setSelectedRate(defaultRate.id)
    }
  }
  
  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.device_code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter
    return matchesSearch && matchesStatus
  })
  
  const handleCommand = async (device: Device, command: 'shutdown' | 'restart' | 'lock' | 'message' | 'admin_unlock') => {
    if (command === 'message') {
      setSelectedDevice(device)
      setShowMessageModal(true)
      return
    }
    
    if (command === 'admin_unlock') {
      setSelectedDevice(device)
      setUnlockDuration('0')
      setShowAdminUnlockModal(true)
      return
    }
    
    const result = await sendDeviceCommand(device.id, command, {}, staff?.id)
    if (result) {
      addToast('success', `${command.charAt(0).toUpperCase() + command.slice(1)} command sent`)
    } else {
      addToast('error', 'Failed to send command')
    }
  }
  
  const handleAdminUnlock = async () => {
    if (!selectedDevice) return
    
    setIsLoading(true)
    const durationMinutes = parseInt(unlockDuration) || 0
    const result = await sendDeviceCommand(
      selectedDevice.id, 
      'admin_unlock', 
      { 
        duration_minutes: durationMinutes,
        unlocked_by: staff?.name || 'Admin'
      },
      staff?.id
    )
    
    if (result) {
      addToast('success', durationMinutes > 0 
        ? `Device unlocked for ${durationMinutes} minutes` 
        : 'Device unlocked (unlimited)')
      setShowAdminUnlockModal(false)
      setSelectedDevice(null)
      setUnlockDuration('0')
    } else {
      addToast('error', 'Failed to unlock device')
    }
    setIsLoading(false)
  }
  
  const handleSendMessage = async () => {
    if (!selectedDevice || !message.trim()) return
    
    setIsLoading(true)
    const result = await sendDeviceCommand(
      selectedDevice.id, 
      'message', 
      { message: message.trim() },
      staff?.id
    )
    
    if (result) {
      addToast('success', 'Message sent to device')
      setShowMessageModal(false)
      setMessage('')
      setSelectedDevice(null)
    } else {
      addToast('error', 'Failed to send message')
    }
    setIsLoading(false)
  }
  
  const handleApprove = async () => {
    if (!selectedDevice || !selectedBranch || !selectedRate) return
    
    setIsLoading(true)
    const success = await approveDevice(
      selectedDevice.id,
      selectedBranch,
      selectedRate,
      deviceName || selectedDevice.name
    )
    
    if (success) {
      addToast('success', 'Device approved successfully')
      setShowApproveModal(false)
      setSelectedDevice(null)
      setSelectedBranch('')
      setSelectedRate('')
      setDeviceName('')
      fetchDevices()
      fetchPendingDevices()
    } else {
      addToast('error', 'Failed to approve device')
    }
    setIsLoading(false)
  }
  
  const openApproveModal = (device: Device) => {
    setSelectedDevice(device)
    setDeviceName(device.name)
    setShowApproveModal(true)
  }
  
  const openDetailsModal = (device: Device) => {
    setSelectedDevice(device)
    setShowDetailsModal(true)
  }
  
  return (
    <div>
      <Header 
        title="Devices" 
        subtitle={`${devices.length} registered devices`}
      />
      
      <main className="p-6">
        {/* Pending Devices Alert */}
        {pendingDevices.length > 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-amber-400">
                    {pendingDevices.length} device{pendingDevices.length > 1 ? 's' : ''} waiting for approval
                  </p>
                  <p className="text-sm text-amber-400/70">
                    These devices have registered and need to be assigned to a branch
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              {pendingDevices.map(device => (
                <div key={device.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-200">{device.name}</p>
                      <p className="text-sm text-slate-500 font-mono">{device.device_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{formatRelativeTime(device.created_at)}</span>
                    <button
                      onClick={() => openApproveModal(device)}
                      className="btn-primary btn-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input input-sm pl-9"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="select input-sm w-40"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="in_use">In Use</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Device Grid/List */}
        {filteredDevices.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDevices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  activeSession={getActiveSessionForDevice(device.id)}
                  onCommand={(cmd) => handleCommand(device, cmd)}
                  onViewDetails={() => openDetailsModal(device)}
                />
              ))}
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Status</th>
                    <th>Branch</th>
                    <th>Rate</th>
                    <th>Last Seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map(device => (
                    <tr key={device.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            device.status === 'in_use' 
                              ? 'bg-rynx-500/20 text-rynx-400' 
                              : device.status === 'online'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-500'
                          }`}>
                            {device.device_type === 'pc' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">{device.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{device.device_code}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(device.status)}`}>
                          {device.status}
                        </span>
                      </td>
                      <td className="text-slate-400">{device.branches?.name || '-'}</td>
                      <td className="text-slate-400">
                        {device.rates ? `₱${device.rates.price_per_unit}/${device.rates.unit_minutes}min` : '-'}
                      </td>
                      <td className="text-slate-400">
                        {device.last_heartbeat ? formatRelativeTime(device.last_heartbeat) : 'Never'}
                      </td>
                      <td>
                        <button
                          onClick={() => openDetailsModal(device)}
                          className="btn-ghost btn-sm"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <EmptyState
            icon={Monitor}
            title="No devices found"
            description={searchQuery ? 'Try adjusting your search or filters' : 'Register a device to get started'}
          />
        )}
      </main>
      
      {/* Approve Device Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Device"
        size="md"
      >
        {selectedDevice && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-100">{selectedDevice.name}</p>
                <p className="text-sm text-slate-500 font-mono">{selectedDevice.device_code}</p>
              </div>
            </div>
            
            {selectedDevice.specs && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/30 rounded-xl text-sm">
                <div>
                  <p className="text-slate-500">CPU</p>
                  <p className="text-slate-200">{selectedDevice.specs.cpu.brand}</p>
                </div>
                <div>
                  <p className="text-slate-500">RAM</p>
                  <p className="text-slate-200">{formatBytes(selectedDevice.specs.memory.total)}</p>
                </div>
                <div>
                  <p className="text-slate-500">OS</p>
                  <p className="text-slate-200">{selectedDevice.specs.os.distro}</p>
                </div>
                <div>
                  <p className="text-slate-500">IP</p>
                  <p className="text-slate-200">{selectedDevice.specs.network.ip}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="label">Device Name</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  placeholder="e.g., PC-001"
                  className="input"
                />
              </div>
              
              <div>
                <label className="label">Assign to Branch</label>
                <select
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="select"
                >
                  <option value="">Select a branch</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
              
              {selectedBranch && (
                <div>
                  <label className="label">Rate</label>
                  <select
                    value={selectedRate}
                    onChange={e => setSelectedRate(e.target.value)}
                    className="select"
                  >
                    <option value="">Select a rate</option>
                    {branchRates.map(rate => (
                      <option key={rate.id} value={rate.id}>
                        {rate.name} - ₱{rate.price_per_unit}/{rate.unit_minutes}min
                        {rate.is_default ? ' (Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={!selectedBranch || !selectedRate || isLoading}
                className="btn-primary"
              >
                {isLoading ? 'Approving...' : 'Approve Device'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Send Message Modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        title="Send Message to Device"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Enter your message..."
              rows={4}
              className="input resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowMessageModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Device Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Device Details"
        size="lg"
      >
        {selectedDevice && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                selectedDevice.status === 'in_use' 
                  ? 'bg-rynx-500/20 text-rynx-400' 
                  : selectedDevice.status === 'online'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800 text-slate-500'
              }`}>
                <Monitor className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-100">{selectedDevice.name}</h3>
                <p className="text-slate-500 font-mono">{selectedDevice.device_code}</p>
                <span className={`badge ${getStatusBadge(selectedDevice.status)} mt-2`}>
                  {selectedDevice.status}
                </span>
              </div>
            </div>
            
            {selectedDevice.specs && (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-300">System Information</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Operating System</span>
                      <span className="text-slate-200">{selectedDevice.specs.os.distro} {selectedDevice.specs.os.release}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Architecture</span>
                      <span className="text-slate-200">{selectedDevice.specs.os.arch}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hostname</span>
                      <span className="text-slate-200">{selectedDevice.specs.os.hostname}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-300">Hardware</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">CPU</span>
                      <span className="text-slate-200">{selectedDevice.specs.cpu.brand}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cores</span>
                      <span className="text-slate-200">{selectedDevice.specs.cpu.physicalCores} physical / {selectedDevice.specs.cpu.cores} logical</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RAM</span>
                      <span className="text-slate-200">{formatBytes(selectedDevice.specs.memory.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Storage</span>
                      <span className="text-slate-200">{formatBytes(selectedDevice.specs.disk.total)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-300">Graphics</h4>
                  <div className="space-y-2">
                    {selectedDevice.specs.graphics.controllers.map((gpu, i) => (
                      <div key={i} className="p-3 bg-slate-800/30 rounded-lg text-sm">
                        <p className="text-slate-200">{gpu.model}</p>
                        <p className="text-slate-500">{gpu.vendor} • {gpu.vram}MB VRAM</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-300">Network</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">IP Address</span>
                      <span className="text-slate-200">{selectedDevice.specs.network.ip}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">MAC Address</span>
                      <span className="text-slate-200 font-mono text-xs">{selectedDevice.specs.network.mac}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Admin Unlock Modal */}
      <Modal
        isOpen={showAdminUnlockModal}
        onClose={() => setShowAdminUnlockModal(false)}
        title="Admin Unlock Device"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-sm text-emerald-400">
              <strong>Superuser Mode:</strong> This will unlock the device without requiring payment or member login. 
              Use this for maintenance, testing, or special access.
            </p>
          </div>
          
          {selectedDevice && (
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <Monitor className="w-5 h-5 text-slate-400" />
              <div>
                <p className="font-medium text-slate-200">{selectedDevice.name}</p>
                <p className="text-sm text-slate-500 font-mono">{selectedDevice.device_code}</p>
              </div>
            </div>
          )}
          
          <div>
            <label className="label">Unlock Duration</label>
            <select
              value={unlockDuration}
              onChange={e => setUnlockDuration(e.target.value)}
              className="select"
            >
              <option value="0">Unlimited (until manually locked)</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
              <option value="240">4 hours</option>
              <option value="480">8 hours</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {unlockDuration === '0' 
                ? 'Device will stay unlocked until you send a lock command' 
                : `Device will automatically lock after ${unlockDuration} minutes`}
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowAdminUnlockModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAdminUnlock}
              disabled={isLoading}
              className="btn-primary bg-emerald-600 hover:bg-emerald-500"
            >
              {isLoading ? 'Unlocking...' : 'Unlock Device'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}