import { useState, useEffect } from 'react'
import { 
  Receipt, 
  Search, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  Wallet,
  CreditCard,
  ArrowLeftRight
} from 'lucide-react'
import { Header, Modal, EmptyState } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/utils'
import type { Transaction, TransactionType } from '@/types'

const typeConfig: Record<TransactionType, { label: string; color: string; icon: typeof TrendingUp }> = {
  topup: { label: 'Top Up', color: 'emerald', icon: TrendingUp },
  usage: { label: 'Usage', color: 'red', icon: TrendingDown },
  refund: { label: 'Refund', color: 'amber', icon: ArrowUpRight },
  adjustment: { label: 'Adjustment', color: 'blue', icon: ArrowLeftRight },
  transfer: { label: 'Transfer', color: 'purple', icon: ArrowLeftRight }
}

export function TransactionsPage() {
  const { transactions, members, branches, fetchTransactions, addToast } = useAppStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const itemsPerPage = 20
  
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])
  
  // Get member and branch info
  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'Guest'
    const member = members.find(m => m.id === memberId)
    return member?.username || member?.full_name || 'Unknown'
  }
  
  const getBranchName = (branchId: string | null) => {
    if (!branchId) return '-'
    const branch = branches.find(b => b.id === branchId)
    return branch?.name || 'Unknown'
  }
  
  // Filter by date range
  const filterByDateRange = (date: string) => {
    const transactionDate = new Date(date)
    const now = new Date()
    
    switch (dateRange) {
      case 'today':
        return transactionDate.toDateString() === now.toDateString()
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7))
        return transactionDate >= weekAgo
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1))
        return transactionDate >= monthAgo
      default:
        return true
    }
  }
  
  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const memberName = getMemberName(tx.member_id).toLowerCase()
    const matchesSearch = 
      memberName.includes(searchQuery.toLowerCase()) ||
      tx.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = typeFilter === 'all' || tx.type === typeFilter
    const matchesDate = filterByDateRange(tx.created_at)
    
    return matchesSearch && matchesType && matchesDate
  })
  
  // Paginated transactions
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = filteredTransactions.slice((page - 1) * itemsPerPage, page * itemsPerPage)
  
  // Stats
  const totalIncome = transactions
    .filter(tx => tx.type === 'topup' && filterByDateRange(tx.created_at))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  
  const totalUsage = transactions
    .filter(tx => tx.type === 'usage' && filterByDateRange(tx.created_at))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  
  const netAmount = totalIncome - totalUsage
  
  const handleRefresh = async () => {
    setIsLoading(true)
    await fetchTransactions()
    setIsLoading(false)
  }
  
  const openDetailsModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setShowDetailsModal(true)
  }
  
  return (
    <div className="p-6">
      <Header 
        title="Transactions"
        subtitle={`${transactions.length} total transactions`}
        action={
          <button
            onClick={handleRefresh}
            className="btn-secondary"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Income</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Usage</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(totalUsage)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Net Amount</p>
              <p className={`text-2xl font-bold ${netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(netAmount)}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              netAmount >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              <Wallet className={`w-5 h-5 ${netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Transactions</p>
              <p className="text-2xl font-bold text-white">{filteredTransactions.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rynx-500/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-rynx-400" />
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
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Search by member, reference, or notes..."
            className="input pl-10"
          />
        </div>
        
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as 'all' | TransactionType); setPage(1) }}
          className="select min-w-[140px]"
        >
          <option value="all">All Types</option>
          <option value="topup">Top Up</option>
          <option value="usage">Usage</option>
          <option value="refund">Refund</option>
          <option value="adjustment">Adjustment</option>
          <option value="transfer">Transfer</option>
        </select>
        
        <select
          value={dateRange}
          onChange={(e) => { setDateRange(e.target.value as 'all' | 'today' | 'week' | 'month'); setPage(1) }}
          className="select min-w-[140px]"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        
        <button className="btn-secondary">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
      
      {/* Transactions Table */}
      {paginatedTransactions.length > 0 ? (
        <>
          <div className="card overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Member</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Payment</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx) => {
                    const config = typeConfig[tx.type]
                    const TypeIcon = config.icon
                    const isPositive = tx.amount > 0 || tx.type === 'topup' || tx.type === 'refund'
                    
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/50">
                        <td>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg bg-${config.color}-500/20 flex items-center justify-center`}>
                              <TypeIcon className={`w-4 h-4 text-${config.color}-400`} />
                            </div>
                            <span className={`badge badge-${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="text-slate-300">{getMemberName(tx.member_id)}</span>
                        </td>
                        <td>
                          <span className={`font-semibold ${
                            tx.type === 'usage' ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {tx.type === 'usage' ? '-' : '+'}
                            {formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </td>
                        <td>
                          {tx.balance_after !== null ? (
                            <span className="text-slate-400">
                              {formatCurrency(tx.balance_after)}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td>
                          {tx.payment_method ? (
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-300 capitalize">{tx.payment_method}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td>
                          {tx.reference ? (
                            <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                              {tx.reference}
                            </code>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td>
                          <span className="text-sm text-slate-400">
                            {formatRelativeTime(tx.created_at)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => openDetailsModal(tx)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No transactions found"
          description={searchQuery || typeFilter !== 'all' || dateRange !== 'all' 
            ? 'Try adjusting your search or filters' 
            : 'Transactions will appear here once members start using their credits'
          }
        />
      )}
      
      {/* Transaction Details Modal */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Transaction Details" size="md">
        {selectedTransaction && (
          <div className="space-y-6">
            {/* Type Banner */}
            {(() => {
              const config = typeConfig[selectedTransaction.type]
              const TypeIcon = config.icon
              return (
                <div className={`p-4 bg-${config.color}-500/10 border border-${config.color}-500/20 rounded-xl`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/20 flex items-center justify-center`}>
                      <TypeIcon className={`w-6 h-6 text-${config.color}-400`} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{config.label}</p>
                      <p className="text-sm text-slate-400">{formatDateTime(selectedTransaction.created_at)}</p>
                    </div>
                  </div>
                </div>
              )
            })()}
            
            {/* Amount */}
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <p className="text-sm text-slate-400 mb-2">Amount</p>
              <p className={`text-4xl font-bold ${
                selectedTransaction.type === 'usage' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {selectedTransaction.type === 'usage' ? '-' : '+'}
                {formatCurrency(Math.abs(selectedTransaction.amount))}
              </p>
            </div>
            
            {/* Balance Change */}
            {selectedTransaction.balance_before !== null && selectedTransaction.balance_after !== null && (
              <div className="flex items-center gap-4">
                <div className="flex-1 p-3 bg-slate-800/50 rounded-lg text-center">
                  <p className="text-xs text-slate-500 mb-1">Before</p>
                  <p className="text-lg font-semibold text-slate-300">
                    {formatCurrency(selectedTransaction.balance_before)}
                  </p>
                </div>
                <ArrowLeftRight className="w-5 h-5 text-slate-500" />
                <div className="flex-1 p-3 bg-slate-800/50 rounded-lg text-center">
                  <p className="text-xs text-slate-500 mb-1">After</p>
                  <p className="text-lg font-semibold text-white">
                    {formatCurrency(selectedTransaction.balance_after)}
                  </p>
                </div>
              </div>
            )}
            
            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Member</p>
                <p className="text-white">{getMemberName(selectedTransaction.member_id)}</p>
              </div>
              
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Branch</p>
                <p className="text-white">{getBranchName(selectedTransaction.branch_id)}</p>
              </div>
              
              {selectedTransaction.payment_method && (
                <div className="p-3 bg-slate-800/30 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Payment Method</p>
                  <p className="text-white capitalize">{selectedTransaction.payment_method}</p>
                </div>
              )}
              
              {selectedTransaction.reference && (
                <div className="p-3 bg-slate-800/30 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Reference</p>
                  <code className="text-sm text-rynx-400">{selectedTransaction.reference}</code>
                </div>
              )}
            </div>
            
            {/* Notes */}
            {selectedTransaction.notes && (
              <div className="p-4 bg-slate-800/30 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">Notes</p>
                <p className="text-slate-300">{selectedTransaction.notes}</p>
              </div>
            )}
            
            {/* Transaction ID */}
            <div className="text-center">
              <p className="text-xs text-slate-600">Transaction ID</p>
              <code className="text-xs text-slate-500">{selectedTransaction.id}</code>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
