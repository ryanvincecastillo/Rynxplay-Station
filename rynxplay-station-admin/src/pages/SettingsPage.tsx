import { useState, useEffect } from 'react'
import { 
  Settings as SettingsIcon,
  Building,
  Users,
  Shield,
  Bell,
  DollarSign,
  Save,
  Edit2,
  Trash2,
  Plus,
  Key,
  Mail,
  UserPlus,
  MapPin,
  Check,
  X
} from 'lucide-react'
import { Header, Modal, EmptyState } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { createBranch, updateBranch, createRate, updateRate } from '@/lib/supabase'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Branch, Rate, StaffRole } from '@/types'

const roleLabels: Record<StaffRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff'
}

export function SettingsPage() {
  const { organization, branches, rates, staff, fetchBranches, fetchRates, addToast } = useAppStore()
  
  const [activeTab, setActiveTab] = useState<'organization' | 'branches' | 'rates' | 'staff'>('organization')
  const [isLoading, setIsLoading] = useState(false)
  
  // Modals
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [showEditBranchModal, setShowEditBranchModal] = useState(false)
  const [showAddRateModal, setShowAddRateModal] = useState(false)
  const [showEditRateModal, setShowEditRateModal] = useState(false)
  
  // Selected items
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)
  
  // Form state
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: ''
  })
  
  const [rateForm, setRateForm] = useState({
    branch_id: '',
    name: '',
    description: '',
    price_per_unit: '',
    unit_minutes: '60',
    is_default: false
  })
  
  useEffect(() => {
    fetchBranches()
    fetchRates()
  }, [fetchBranches, fetchRates])
  
  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building },
    { id: 'branches', label: 'Branches', icon: MapPin },
    { id: 'rates', label: 'Rates', icon: DollarSign },
    { id: 'staff', label: 'Staff', icon: Users }
  ]
  
  // Branch handlers
  const resetBranchForm = () => {
    setBranchForm({ name: '', address: '' })
  }
  
  const handleAddBranch = async () => {
    if (!branchForm.name || !organization) {
      addToast({ type: 'error', message: 'Branch name is required' })
      return
    }
    
    setIsLoading(true)
    const branch = await createBranch(organization.id, branchForm.name, branchForm.address || null)
    
    if (branch) {
      addToast({ type: 'success', message: `Branch "${branchForm.name}" created successfully` })
      setShowAddBranchModal(false)
      resetBranchForm()
      fetchBranches()
    } else {
      addToast({ type: 'error', message: 'Failed to create branch' })
    }
    setIsLoading(false)
  }
  
  const handleEditBranch = async () => {
    if (!selectedBranch || !branchForm.name) return
    
    setIsLoading(true)
    const updated = await updateBranch(selectedBranch.id, {
      name: branchForm.name,
      address: branchForm.address || null
    })
    
    if (updated) {
      addToast({ type: 'success', message: 'Branch updated successfully' })
      setShowEditBranchModal(false)
      setSelectedBranch(null)
      resetBranchForm()
      fetchBranches()
    } else {
      addToast({ type: 'error', message: 'Failed to update branch' })
    }
    setIsLoading(false)
  }
  
  const openEditBranchModal = (branch: Branch) => {
    setSelectedBranch(branch)
    setBranchForm({
      name: branch.name,
      address: branch.address || ''
    })
    setShowEditBranchModal(true)
  }
  
  // Rate handlers
  const resetRateForm = () => {
    setRateForm({
      branch_id: branches[0]?.id || '',
      name: '',
      description: '',
      price_per_unit: '',
      unit_minutes: '60',
      is_default: false
    })
  }
  
  const handleAddRate = async () => {
    if (!rateForm.name || !rateForm.price_per_unit || !rateForm.branch_id) {
      addToast({ type: 'error', message: 'Please fill in all required fields' })
      return
    }
    
    setIsLoading(true)
    const rate = await createRate(rateForm.branch_id, {
      name: rateForm.name,
      description: rateForm.description || null,
      price_per_unit: parseFloat(rateForm.price_per_unit),
      unit_minutes: parseInt(rateForm.unit_minutes),
      is_default: rateForm.is_default
    })
    
    if (rate) {
      addToast({ type: 'success', message: `Rate "${rateForm.name}" created successfully` })
      setShowAddRateModal(false)
      resetRateForm()
      fetchRates()
    } else {
      addToast({ type: 'error', message: 'Failed to create rate' })
    }
    setIsLoading(false)
  }
  
  const handleEditRate = async () => {
    if (!selectedRate || !rateForm.name || !rateForm.price_per_unit) return
    
    setIsLoading(true)
    const updated = await updateRate(selectedRate.id, {
      name: rateForm.name,
      description: rateForm.description || null,
      price_per_unit: parseFloat(rateForm.price_per_unit),
      unit_minutes: parseInt(rateForm.unit_minutes),
      is_default: rateForm.is_default
    })
    
    if (updated) {
      addToast({ type: 'success', message: 'Rate updated successfully' })
      setShowEditRateModal(false)
      setSelectedRate(null)
      resetRateForm()
      fetchRates()
    } else {
      addToast({ type: 'error', message: 'Failed to update rate' })
    }
    setIsLoading(false)
  }
  
  const openEditRateModal = (rate: Rate) => {
    setSelectedRate(rate)
    setRateForm({
      branch_id: rate.branch_id,
      name: rate.name,
      description: rate.description || '',
      price_per_unit: String(rate.price_per_unit),
      unit_minutes: String(rate.unit_minutes),
      is_default: rate.is_default
    })
    setShowEditRateModal(true)
  }
  
  const openAddRateModal = () => {
    resetRateForm()
    setShowAddRateModal(true)
  }
  
  return (
    <div className="p-6">
      <Header 
        title="Settings"
        subtitle="Manage your organization settings"
      />
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-rynx-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
      
      {/* Organization Tab */}
      {activeTab === 'organization' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Organization Details</h3>
          
          {organization ? (
            <div className="space-y-6">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-rynx-500/20 to-blue-500/20 flex items-center justify-center">
                  <Building className="w-10 h-10 text-rynx-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-1">{organization.name}</h2>
                  <p className="text-slate-400">@{organization.slug}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-sm text-slate-400 mb-1">Organization ID</p>
                  <code className="text-sm text-rynx-400">{organization.id}</code>
                </div>
                
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-sm text-slate-400 mb-1">Created</p>
                  <p className="text-white">{formatDateTime(organization.created_at)}</p>
                </div>
                
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-sm text-slate-400 mb-1">Total Branches</p>
                  <p className="text-2xl font-bold text-white">{branches.length}</p>
                </div>
                
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-sm text-slate-400 mb-1">Active Rates</p>
                  <p className="text-2xl font-bold text-white">{rates.filter(r => r.is_active).length}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No organization data available</p>
          )}
        </div>
      )}
      
      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Branches</h3>
            <button
              onClick={() => { resetBranchForm(); setShowAddBranchModal(true) }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Branch</span>
            </button>
          </div>
          
          {branches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch) => (
                <div key={branch.id} className="card p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rynx-500/20 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-rynx-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{branch.name}</h4>
                        <span className={`badge text-xs ${branch.is_active ? 'badge-success' : 'badge-default'}`}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openEditBranchModal(branch)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {branch.address && (
                    <p className="text-sm text-slate-400 mb-3">{branch.address}</p>
                  )}
                  
                  <div className="text-xs text-slate-500">
                    Created {formatDateTime(branch.created_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MapPin}
              title="No branches yet"
              description="Create your first branch to get started"
              action={
                <button onClick={() => { resetBranchForm(); setShowAddBranchModal(true) }} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  <span>Add Branch</span>
                </button>
              }
            />
          )}
        </div>
      )}
      
      {/* Rates Tab */}
      {activeTab === 'rates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Pricing Rates</h3>
            <button
              onClick={openAddRateModal}
              className="btn-primary"
              disabled={branches.length === 0}
            >
              <Plus className="w-4 h-4" />
              <span>Add Rate</span>
            </button>
          </div>
          
          {branches.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-slate-400">Create a branch first before adding rates</p>
            </div>
          ) : rates.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Branch</th>
                    <th>Price</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => {
                    const branch = branches.find(b => b.id === rate.branch_id)
                    return (
                      <tr key={rate.id} className="hover:bg-slate-800/50">
                        <td>
                          <div>
                            <p className="font-medium text-white">{rate.name}</p>
                            {rate.description && (
                              <p className="text-sm text-slate-400">{rate.description}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="text-slate-300">{branch?.name || '-'}</span>
                        </td>
                        <td>
                          <span className="font-semibold text-emerald-400">
                            {formatCurrency(rate.price_per_unit)}
                          </span>
                        </td>
                        <td>
                          <span className="text-slate-300">{rate.unit_minutes} min</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${rate.is_active ? 'badge-success' : 'badge-default'}`}>
                              {rate.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {rate.is_default && (
                              <span className="badge badge-info">Default</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => openEditRateModal(rate)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={DollarSign}
              title="No rates configured"
              description="Create pricing rates for your branches"
              action={
                <button onClick={openAddRateModal} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  <span>Add Rate</span>
                </button>
              }
            />
          )}
        </div>
      )}
      
      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Staff Members</h3>
            <button className="btn-primary">
              <UserPlus className="w-4 h-4" />
              <span>Invite Staff</span>
            </button>
          </div>
          
          <div className="card p-6 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-white mb-2">Staff Management</h4>
            <p className="text-slate-400 mb-4">
              Staff management feature coming soon. You'll be able to invite and manage staff members here.
            </p>
          </div>
        </div>
      )}
      
      {/* Add Branch Modal */}
      <Modal isOpen={showAddBranchModal} onClose={() => setShowAddBranchModal(false)} title="Add Branch" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Branch Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              placeholder="e.g., Main Branch, Downtown Location"
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
            <textarea
              value={branchForm.address}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              placeholder="Full address of the branch"
              rows={3}
              className="input resize-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowAddBranchModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleAddBranch} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Creating...' : 'Create Branch'}
          </button>
        </div>
      </Modal>
      
      {/* Edit Branch Modal */}
      <Modal isOpen={showEditBranchModal} onClose={() => setShowEditBranchModal(false)} title="Edit Branch" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Branch Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
            <textarea
              value={branchForm.address}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              rows={3}
              className="input resize-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowEditBranchModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleEditBranch} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>
      
      {/* Add Rate Modal */}
      <Modal isOpen={showAddRateModal} onClose={() => setShowAddRateModal(false)} title="Add Rate" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Branch <span className="text-red-400">*</span>
            </label>
            <select
              value={rateForm.branch_id}
              onChange={(e) => setRateForm({ ...rateForm, branch_id: e.target.value })}
              className="select"
            >
              <option value="">Select a branch</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Rate Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={rateForm.name}
              onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
              placeholder="e.g., Regular, VIP, Promo"
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <input
              type="text"
              value={rateForm.description}
              onChange={(e) => setRateForm({ ...rateForm, description: e.target.value })}
              placeholder="Optional description"
              className="input"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Price (PHP) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={rateForm.price_per_unit}
                onChange={(e) => setRateForm({ ...rateForm, price_per_unit: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Duration (minutes) <span className="text-red-400">*</span>
              </label>
              <select
                value={rateForm.unit_minutes}
                onChange={(e) => setRateForm({ ...rateForm, unit_minutes: e.target.value })}
                className="select"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rateForm.is_default}
              onChange={(e) => setRateForm({ ...rateForm, is_default: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rynx-500 focus:ring-rynx-500"
            />
            <span className="text-slate-300">Set as default rate for this branch</span>
          </label>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowAddRateModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleAddRate} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Creating...' : 'Create Rate'}
          </button>
        </div>
      </Modal>
      
      {/* Edit Rate Modal */}
      <Modal isOpen={showEditRateModal} onClose={() => setShowEditRateModal(false)} title="Edit Rate" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Rate Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={rateForm.name}
              onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <input
              type="text"
              value={rateForm.description}
              onChange={(e) => setRateForm({ ...rateForm, description: e.target.value })}
              className="input"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Price (PHP) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={rateForm.price_per_unit}
                onChange={(e) => setRateForm({ ...rateForm, price_per_unit: e.target.value })}
                min="0"
                step="0.01"
                className="input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Duration (minutes)
              </label>
              <select
                value={rateForm.unit_minutes}
                onChange={(e) => setRateForm({ ...rateForm, unit_minutes: e.target.value })}
                className="select"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rateForm.is_default}
              onChange={(e) => setRateForm({ ...rateForm, is_default: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rynx-500 focus:ring-rynx-500"
            />
            <span className="text-slate-300">Set as default rate</span>
          </label>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowEditRateModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleEditRate} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
