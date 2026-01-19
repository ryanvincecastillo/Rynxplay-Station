import { useState, useEffect, useCallback } from 'react'
import { 
  Coins, 
  Monitor, 
  Timer, 
  Play,
  RotateCcw,
  CircleDollarSign,
  Zap,
  User,
  Users,
  ChevronDown
} from 'lucide-react'
import { Header, Modal } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { formatCurrency, formatDuration, cn } from '@/lib/utils'
import type { Device, Member, Rate } from '@/types'
import { getSupabase, getRates } from '@/lib/supabase'

// Coin denominations (Philippine Peso)
const COIN_DENOMINATIONS = [
  { value: 1, label: '₱1', color: 'from-amber-600 to-amber-700' },
  { value: 5, label: '₱5', color: 'from-yellow-500 to-yellow-600' },
  { value: 10, label: '₱10', color: 'from-slate-400 to-slate-500' },
  { value: 20, label: '₱20', color: 'from-amber-400 to-amber-500' },
]

// Coin animation component
function CoinAnimation({ value, onComplete }: { value: number; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 800)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="animate-coin-drop">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 border-4 border-amber-300">
          <span className="text-xl font-bold text-amber-900">₱{value}</span>
        </div>
      </div>
    </div>
  )
}

// Inserted coin display
function InsertedCoinStack({ coins }: { coins: number[] }) {
  const grouped = coins.reduce((acc, coin) => {
    acc[coin] = (acc[coin] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  return (
    <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
      {Object.entries(grouped).map(([value, count]) => (
        <div 
          key={value} 
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <span className="text-[10px] font-bold text-amber-900">{value}</span>
          </div>
          <span className="text-sm text-slate-300">×{count}</span>
        </div>
      ))}
      {coins.length === 0 && (
        <span className="text-slate-500 text-sm">No coins inserted</span>
      )}
    </div>
  )
}

export function KioskPage() {
  const { devices, members, organization, staff, addToast, fetchDevices, fetchMembers } = useAppStore()
  
  // State
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [insertedCoins, setInsertedCoins] = useState<number[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [animatingCoin, setAnimatingCoin] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionMode, setSessionMode] = useState<'guest' | 'member'>('guest')
  const [deviceRate, setDeviceRate] = useState<Rate | null>(null)
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<{
    type: 'session' | 'topup'
    amount: number
    device?: string
    member?: string
    timeMinutes?: number
  } | null>(null)

  // Filter available devices (online, not in use)
  const availableDevices = devices.filter(d => 
    d.status === 'online' || d.status === 'offline'
  )

  // Load device rate when device is selected
  useEffect(() => {
    if (selectedDevice?.rate_id && selectedDevice.branch_id) {
      getRates(selectedDevice.branch_id).then(rates => {
        const rate = rates.find(r => r.id === selectedDevice.rate_id)
        setDeviceRate(rate || null)
      })
    } else {
      setDeviceRate(null)
    }
  }, [selectedDevice])

  // Fetch data on mount
  useEffect(() => {
    fetchDevices()
    fetchMembers()
  }, [])

  // Calculate time from amount based on rate
  const calculateTime = useCallback((amount: number): number => {
    if (!deviceRate || deviceRate.price_per_unit <= 0) return 0
    return Math.floor((amount / deviceRate.price_per_unit) * deviceRate.unit_minutes * 60) // returns seconds
  }, [deviceRate])

  // Handle coin insertion
  const handleInsertCoin = (value: number) => {
    setAnimatingCoin(value)
    
    // Play coin sound effect (optional - browser may block autoplay)
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAAMJL/4NzJeBwAADyZ/+TZwXcGAAA7m//o2cF8CQAANpX/6dfDfwgAADOS/+rXw38HAAAyjP/s1MV9BgAAMov/7NPGfgYAAC6J/+3Tx34EAAA4h//v0cd8AQAAOYP/8s/IfAEAADmB//LNyHoAAQA5gP/zzMl6AQAAOX7/88vJegEAADl9//TLyXoAAABQfv/x')
      audio.volume = 0.3
      audio.play().catch(() => {})
    } catch {}
  }

  const handleCoinAnimationComplete = () => {
    if (animatingCoin !== null) {
      setInsertedCoins(prev => [...prev, animatingCoin])
      setTotalAmount(prev => prev + animatingCoin)
      setAnimatingCoin(null)
    }
  }

  // Reset all
  const handleReset = () => {
    setInsertedCoins([])
    setTotalAmount(0)
    setSelectedDevice(null)
    setSelectedMember(null)
    setSessionMode('guest')
  }

  // Start guest session
  const handleStartGuestSession = async () => {
    if (!selectedDevice || totalAmount <= 0 || !deviceRate) {
      addToast('error', 'Please select a device and insert coins')
      return
    }

    setIsProcessing(true)
    
    try {
      const supabase = getSupabase()
      const timeSeconds = calculateTime(totalAmount)
      
      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          device_id: selectedDevice.id,
          rate_id: deviceRate.id,
          session_type: 'guest',
          time_remaining_seconds: timeSeconds,
          total_amount: totalAmount,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Update device status
      const { error: deviceError } = await supabase
        .from('devices')
        .update({
          status: 'in_use',
          current_session_id: session.id,
          is_locked: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDevice.id)

      if (deviceError) throw deviceError

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          branch_id: selectedDevice.branch_id,
          session_id: session.id,
          type: 'topup',
          amount: totalAmount,
          payment_method: 'coin',
          notes: `Kiosk - Guest session on ${selectedDevice.name}`,
          created_by: staff?.id
        })

      // Send unlock command to device
      await supabase
        .from('device_commands')
        .insert({
          device_id: selectedDevice.id,
          command_type: 'unlock',
          payload: { 
            session_id: session.id,
            time_remaining: timeSeconds,
            session_type: 'guest'
          },
          created_by: staff?.id
        })

      setLastTransaction({
        type: 'session',
        amount: totalAmount,
        device: selectedDevice.name,
        timeMinutes: Math.floor(timeSeconds / 60)
      })
      setShowSuccessModal(true)
      
      // Reset
      setInsertedCoins([])
      setTotalAmount(0)
      setSelectedDevice(null)
      fetchDevices()
      
      addToast('success', `Session started on ${selectedDevice.name}`)
    } catch (error) {
      console.error('Error starting session:', error)
      addToast('error', 'Failed to start session')
    } finally {
      setIsProcessing(false)
    }
  }

  // Top up member credits
  const handleTopUpMember = async () => {
    if (!selectedMember || totalAmount <= 0) {
      addToast('error', 'Please select a member and insert coins')
      return
    }

    setIsProcessing(true)

    try {
      const supabase = getSupabase()
      const newBalance = selectedMember.credits + totalAmount

      // Update member credits
      const { error: memberError } = await supabase
        .from('members')
        .update({ 
          credits: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMember.id)

      if (memberError) throw memberError

      // Get a branch for the transaction (use first branch or staff's branch)
      const branchId = staff?.branch_id || (await supabase
        .from('branches')
        .select('id')
        .eq('org_id', organization?.id)
        .limit(1)
        .single()).data?.id

      // Create transaction record
      if (branchId) {
        await supabase
          .from('transactions')
          .insert({
            member_id: selectedMember.id,
            branch_id: branchId,
            type: 'topup',
            amount: totalAmount,
            balance_before: selectedMember.credits,
            balance_after: newBalance,
            payment_method: 'coin',
            notes: 'Kiosk - Coin top-up',
            created_by: staff?.id
          })
      }

      setLastTransaction({
        type: 'topup',
        amount: totalAmount,
        member: selectedMember.username
      })
      setShowSuccessModal(true)

      // Reset
      setInsertedCoins([])
      setTotalAmount(0)
      setSelectedMember(null)
      fetchMembers()

      addToast('success', `Added ${formatCurrency(totalAmount)} to ${selectedMember.username}`)
    } catch (error) {
      console.error('Error topping up member:', error)
      addToast('error', 'Failed to top up member')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <Header 
        title="Kiosk Simulation" 
        subtitle="Simulate coin-operated payment kiosk"
      />

      {/* Coin animation */}
      {animatingCoin !== null && (
        <CoinAnimation value={animatingCoin} onComplete={handleCoinAnimationComplete} />
      )}

      <main className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Mode Selection */}
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Session Mode</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setSessionMode('guest')
                  setSelectedMember(null)
                }}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all',
                  sessionMode === 'guest'
                    ? 'border-rynx-500 bg-rynx-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    sessionMode === 'guest' ? 'bg-rynx-500/20' : 'bg-slate-700'
                  )}>
                    <User className={cn(
                      'w-5 h-5',
                      sessionMode === 'guest' ? 'text-rynx-400' : 'text-slate-400'
                    )} />
                  </div>
                  <span className={cn(
                    'font-semibold',
                    sessionMode === 'guest' ? 'text-rynx-400' : 'text-slate-300'
                  )}>Guest Session</span>
                </div>
                <p className="text-sm text-slate-500 text-left">
                  Pay-as-you-go with countdown timer
                </p>
              </button>

              <button
                onClick={() => {
                  setSessionMode('member')
                  setSelectedDevice(null)
                }}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all',
                  sessionMode === 'member'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    sessionMode === 'member' ? 'bg-purple-500/20' : 'bg-slate-700'
                  )}>
                    <Users className={cn(
                      'w-5 h-5',
                      sessionMode === 'member' ? 'text-purple-400' : 'text-slate-400'
                    )} />
                  </div>
                  <span className={cn(
                    'font-semibold',
                    sessionMode === 'member' ? 'text-purple-400' : 'text-slate-300'
                  )}>Member Top-up</span>
                </div>
                <p className="text-sm text-slate-500 text-left">
                  Add credits to member account
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Selection & Coin Slot */}
            <div className="space-y-6">
              {/* Device/Member Selection */}
              <div className="card p-6">
                {sessionMode === 'guest' ? (
                  <>
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-rynx-400" />
                      Select Device
                    </h3>
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                        className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between hover:border-slate-600 transition-colors"
                      >
                        {selectedDevice ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-rynx-500/20 flex items-center justify-center">
                              <Monitor className="w-5 h-5 text-rynx-400" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-slate-200">{selectedDevice.name}</p>
                              <p className="text-sm text-slate-500">{selectedDevice.device_code}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Choose a device...</span>
                        )}
                        <ChevronDown className={cn(
                          'w-5 h-5 text-slate-400 transition-transform',
                          showDeviceDropdown && 'rotate-180'
                        )} />
                      </button>

                      {showDeviceDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                          {availableDevices.length > 0 ? (
                            availableDevices.map(device => (
                              <button
                                key={device.id}
                                onClick={() => {
                                  setSelectedDevice(device)
                                  setShowDeviceDropdown(false)
                                }}
                                className="w-full p-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors"
                              >
                                <div className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center',
                                  device.status === 'online' ? 'bg-emerald-500/20' : 'bg-slate-700'
                                )}>
                                  <Monitor className={cn(
                                    'w-4 h-4',
                                    device.status === 'online' ? 'text-emerald-400' : 'text-slate-400'
                                  )} />
                                </div>
                                <div className="text-left flex-1">
                                  <p className="font-medium text-slate-200">{device.name}</p>
                                  <p className="text-xs text-slate-500">{device.device_code}</p>
                                </div>
                                <span className={cn(
                                  'text-xs px-2 py-1 rounded-full',
                                  device.status === 'online' 
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-slate-600/50 text-slate-400'
                                )}>
                                  {device.status}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-slate-500">
                              No available devices
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rate Info */}
                    {deviceRate && (
                      <div className="mt-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <p className="text-sm text-slate-400">
                          Rate: <span className="text-rynx-400 font-medium">{formatCurrency(deviceRate.price_per_unit)}</span> per {deviceRate.unit_minutes} min
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      Select Member
                    </h3>
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                        className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between hover:border-slate-600 transition-colors"
                      >
                        {selectedMember ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                              <span className="text-purple-400 font-semibold">
                                {selectedMember.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-slate-200">{selectedMember.username}</p>
                              <p className="text-sm text-slate-500">Balance: {formatCurrency(selectedMember.credits)}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Choose a member...</span>
                        )}
                        <ChevronDown className={cn(
                          'w-5 h-5 text-slate-400 transition-transform',
                          showMemberDropdown && 'rotate-180'
                        )} />
                      </button>

                      {showMemberDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                          {members.filter(m => m.is_active).length > 0 ? (
                            members.filter(m => m.is_active).map(member => (
                              <button
                                key={member.id}
                                onClick={() => {
                                  setSelectedMember(member)
                                  setShowMemberDropdown(false)
                                }}
                                className="w-full p-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                  <span className="text-purple-400 font-semibold text-sm">
                                    {member.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-left flex-1">
                                  <p className="font-medium text-slate-200">{member.username}</p>
                                  <p className="text-xs text-slate-500">{member.full_name || 'No name'}</p>
                                </div>
                                <span className="text-sm text-emerald-400 font-medium">
                                  {formatCurrency(member.credits)}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-slate-500">
                              No active members
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Coin Slot */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  Insert Coins
                </h3>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  {COIN_DENOMINATIONS.map(coin => (
                    <button
                      key={coin.value}
                      onClick={() => handleInsertCoin(coin.value)}
                      disabled={animatingCoin !== null || isProcessing}
                      className={cn(
                        'aspect-square rounded-full bg-gradient-to-br flex items-center justify-center',
                        'shadow-lg transform transition-all duration-150',
                        'hover:scale-110 hover:-translate-y-1 active:scale-95',
                        'disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0',
                        'border-4 border-amber-300/50',
                        coin.color
                      )}
                    >
                      <span className="text-lg font-bold text-amber-900">{coin.label}</span>
                    </button>
                  ))}
                </div>

                {/* Inserted coins display */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                  <p className="text-sm text-slate-500 mb-2 text-center">Inserted Coins</p>
                  <InsertedCoinStack coins={insertedCoins} />
                </div>
              </div>
            </div>

            {/* Right: Summary & Action */}
            <div className="space-y-6">
              {/* Amount Display */}
              <div className="card p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-rynx-500/30">
                <div className="text-center">
                  <CircleDollarSign className="w-12 h-12 text-rynx-400 mx-auto mb-4" />
                  <p className="text-slate-500 mb-2">Total Amount</p>
                  <p className="text-5xl font-bold text-white mb-2">
                    {formatCurrency(totalAmount)}
                  </p>
                  
                  {sessionMode === 'guest' && deviceRate && totalAmount > 0 && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-xl">
                      <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <Timer className="w-5 h-5" />
                        <span className="text-2xl font-mono font-semibold">
                          {formatDuration(calculateTime(totalAmount))}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">Session time</p>
                    </div>
                  )}

                  {sessionMode === 'member' && selectedMember && totalAmount > 0 && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-sm text-slate-500">New Balance</p>
                      <p className="text-2xl font-semibold text-purple-400">
                        {formatCurrency(selectedMember.credits + totalAmount)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="card p-6 space-y-4">
                {sessionMode === 'guest' ? (
                  <button
                    onClick={handleStartGuestSession}
                    disabled={!selectedDevice || totalAmount <= 0 || !deviceRate || isProcessing}
                    className={cn(
                      'w-full btn-primary py-4 text-lg flex items-center justify-center gap-2',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Start Session
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleTopUpMember}
                    disabled={!selectedMember || totalAmount <= 0 || isProcessing}
                    className={cn(
                      'w-full py-4 text-lg flex items-center justify-center gap-2 rounded-xl font-semibold',
                      'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400',
                      'text-white transition-all shadow-lg shadow-purple-500/25',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Top Up Member
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="w-full btn-ghost py-3 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              {/* Instructions */}
              <div className="card p-6 bg-slate-900/50">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  How to use
                </h4>
                <ol className="space-y-2 text-sm text-slate-500">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                    {sessionMode === 'guest' 
                      ? 'Select an available device'
                      : 'Select a member account'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                    Click the coin buttons to insert coins
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                    {sessionMode === 'guest'
                      ? 'Click "Start Session" to begin'
                      : 'Click "Top Up Member" to add credits'
                    }
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          
          <h3 className="text-xl font-semibold text-slate-100 mb-2">
            {lastTransaction?.type === 'session' ? 'Session Started!' : 'Top-up Successful!'}
          </h3>
          
          <p className="text-slate-400 mb-6">
            {lastTransaction?.type === 'session' ? (
              <>
                {lastTransaction.device} now has <span className="text-rynx-400 font-semibold">{lastTransaction.timeMinutes} minutes</span> of session time.
              </>
            ) : (
              <>
                Added <span className="text-emerald-400 font-semibold">{formatCurrency(lastTransaction?.amount || 0)}</span> to {lastTransaction?.member}'s account.
              </>
            )}
          </p>

          <button
            onClick={() => setShowSuccessModal(false)}
            className="btn-primary px-8"
          >
            Done
          </button>
        </div>
      </Modal>
    </div>
  )
}