import { useState, useEffect } from 'react'
import { 
  Users, 
  Search, 
  Plus, 
  MoreVertical,
  Edit2,
  Trash2,
  Wallet,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  UserCheck,
  UserX,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react'
import { Header, Modal, EmptyState } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { createMember, updateMember, addMemberCredits } from '@/lib/supabase'
import { formatCurrency, formatRelativeTime, formatDateTime } from '@/lib/utils'
import type { Member } from '@/types'

export function MembersPage() {
  const { members, organization, fetchMembers, addToast } = useAppStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTopupModal, setShowTopupModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    pin_code: '',
    full_name: '',
    email: '',
    phone: ''
  })
  const [topupAmount, setTopupAmount] = useState('')
  
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])
  
  // Filtered members
  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && member.is_active) ||
      (statusFilter === 'inactive' && !member.is_active)
    
    return matchesSearch && matchesStatus
  })
  
  // Stats
  const totalCredits = members.reduce((sum, m) => sum + m.credits, 0)
  const activeCount = members.filter(m => m.is_active).length
  
  const handleRefresh = async () => {
    setIsLoading(true)
    await fetchMembers()
    setIsLoading(false)
  }
  
  const resetForm = () => {
    setFormData({
      username: '',
      pin_code: '',
      full_name: '',
      email: '',
      phone: ''
    })
  }
  
  const handleAddMember = async () => {
    if (!formData.username || !formData.pin_code || !organization) {
      addToast({ type: 'error', message: 'Username and PIN are required' })
      return
    }
    
    setIsLoading(true)
    const member = await createMember(organization.id, {
      username: formData.username,
      pin_code: formData.pin_code,
      full_name: formData.full_name || null,
      email: formData.email || null,
      phone: formData.phone || null
    })
    
    if (member) {
      addToast({ type: 'success', message: `Member ${formData.username} created successfully` })
      setShowAddModal(false)
      resetForm()
      fetchMembers()
    } else {
      addToast({ type: 'error', message: 'Failed to create member' })
    }
    setIsLoading(false)
  }
  
  const handleEditMember = async () => {
    if (!selectedMember) return
    
    setIsLoading(true)
    const updated = await updateMember(selectedMember.id, {
      full_name: formData.full_name || null,
      email: formData.email || null,
      phone: formData.phone || null
    })
    
    if (updated) {
      addToast({ type: 'success', message: 'Member updated successfully' })
      setShowEditModal(false)
      setSelectedMember(null)
      resetForm()
      fetchMembers()
    } else {
      addToast({ type: 'error', message: 'Failed to update member' })
    }
    setIsLoading(false)
  }
  
  const handleTopup = async () => {
    if (!selectedMember || !topupAmount) return
    
    const amount = parseFloat(topupAmount)
    if (isNaN(amount) || amount <= 0) {
      addToast({ type: 'error', message: 'Please enter a valid amount' })
      return
    }
    
    setIsLoading(true)
    const success = await addMemberCredits(selectedMember.id, amount)
    
    if (success) {
      addToast({ type: 'success', message: `Added ${formatCurrency(amount)} credits to ${selectedMember.username}` })
      setShowTopupModal(false)
      setSelectedMember(null)
      setTopupAmount('')
      fetchMembers()
    } else {
      addToast({ type: 'error', message: 'Failed to add credits' })
    }
    setIsLoading(false)
  }
  
  const openEditModal = (member: Member) => {
    setSelectedMember(member)
    setFormData({
      username: member.username,
      pin_code: '',
      full_name: member.full_name || '',
      email: member.email || '',
      phone: member.phone || ''
    })
    setShowEditModal(true)
  }
  
  const openTopupModal = (member: Member) => {
    setSelectedMember(member)
    setTopupAmount('')
    setShowTopupModal(true)
  }
  
  const openDetailsModal = (member: Member) => {
    setSelectedMember(member)
    setShowDetailsModal(true)
  }
  
  return (
    <div className="p-6">
      <Header 
        title="Members"
        subtitle={`${members.length} registered members`}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="btn-secondary"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => { resetForm(); setShowAddModal(true) }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>
        }
      />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Members</p>
              <p className="text-2xl font-bold text-white">{members.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rynx-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-rynx-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Members</p>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Inactive Members</p>
              <p className="text-2xl font-bold text-white">{members.length - activeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
              <UserX className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Credits</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalCredits)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, name, or email..."
            className="input pl-10"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="select min-w-[150px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        
        <button className="btn-secondary">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
      
      {/* Members Table */}
      {filteredMembers.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Contact</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-800/50">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rynx-500/20 to-blue-500/20 flex items-center justify-center">
                          <span className="text-rynx-400 font-semibold text-sm">
                            {member.username.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{member.username}</p>
                          {member.full_name && (
                            <p className="text-sm text-slate-400">{member.full_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        {member.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Mail className="w-3.5 h-3.5" />
                            <span>{member.email}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {!member.email && !member.phone && (
                          <span className="text-sm text-slate-500">No contact info</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`font-semibold ${member.credits > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {formatCurrency(member.credits)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${member.is_active ? 'badge-success' : 'badge-default'}`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-slate-400">
                        {formatRelativeTime(member.created_at)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openTopupModal(member)}
                          className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Add Credits"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(member)}
                          className="p-2 text-slate-400 hover:text-rynx-400 hover:bg-rynx-500/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDetailsModal(member)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No members found"
          description={searchQuery ? 'Try adjusting your search or filters' : 'Add your first member to get started'}
          action={
            !searchQuery && (
              <button onClick={() => { resetForm(); setShowAddModal(true) }} className="btn-primary">
                <Plus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            )
          }
        />
      )}
      
      {/* Add Member Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Member" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Username <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="e.g., john_doe"
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              PIN Code <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.pin_code}
              onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
              placeholder="4-6 digit PIN"
              maxLength={6}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+63 912 345 6789"
              className="input"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowAddModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleAddMember} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Creating...' : 'Create Member'}
          </button>
        </div>
      </Modal>
      
      {/* Edit Member Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Member" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              disabled
              className="input opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Username cannot be changed</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowEditModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleEditMember} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>
      
      {/* Top Up Modal */}
      <Modal isOpen={showTopupModal} onClose={() => setShowTopupModal(false)} title="Add Credits" size="sm">
        {selectedMember && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-xl">
              <p className="text-sm text-slate-400 mb-1">Adding credits to</p>
              <p className="text-lg font-semibold text-white">{selectedMember.username}</p>
              <p className="text-sm text-slate-400 mt-2">
                Current balance: <span className="text-emerald-400 font-medium">{formatCurrency(selectedMember.credits)}</span>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Amount (PHP)</label>
              <input
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input text-lg"
              />
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 200].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTopupAmount(String(amount))}
                  className="btn-secondary py-2 text-sm"
                >
                  ₱{amount}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowTopupModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleTopup} 
            disabled={isLoading || !topupAmount} 
            className="btn-primary bg-emerald-500 hover:bg-emerald-600"
          >
            {isLoading ? 'Processing...' : 'Add Credits'}
          </button>
        </div>
      </Modal>
      
      {/* Details Modal */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Member Details" size="md">
        {selectedMember && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-rynx-500/20 to-blue-500/20 flex items-center justify-center">
                <span className="text-rynx-400 font-bold text-xl">
                  {selectedMember.username.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedMember.username}</h3>
                {selectedMember.full_name && (
                  <p className="text-slate-400">{selectedMember.full_name}</p>
                )}
                <span className={`badge mt-2 ${selectedMember.is_active ? 'badge-success' : 'badge-default'}`}>
                  {selectedMember.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            {/* Credits */}
            <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm text-slate-400 mb-1">Credit Balance</p>
              <p className="text-3xl font-bold text-emerald-400">{formatCurrency(selectedMember.credits)}</p>
            </div>
            
            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-xs">Email</span>
                </div>
                <p className="text-white text-sm">{selectedMember.email || '-'}</p>
              </div>
              
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Phone className="w-4 h-4" />
                  <span className="text-xs">Phone</span>
                </div>
                <p className="text-white text-sm">{selectedMember.phone || '-'}</p>
              </div>
              
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Joined</span>
                </div>
                <p className="text-white text-sm">{formatDateTime(selectedMember.created_at)}</p>
              </div>
              
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Last Updated</span>
                </div>
                <p className="text-white text-sm">{formatDateTime(selectedMember.updated_at)}</p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowDetailsModal(false); openTopupModal(selectedMember) }}
                className="btn-primary bg-emerald-500 hover:bg-emerald-600 flex-1"
              >
                <DollarSign className="w-4 h-4" />
                <span>Add Credits</span>
              </button>
              <button 
                onClick={() => { setShowDetailsModal(false); openEditModal(selectedMember) }}
                className="btn-secondary flex-1"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
