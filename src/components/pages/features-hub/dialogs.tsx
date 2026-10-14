'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { BOQItem } from './types'
import { DEMO_ENGINEERS, DEMO_PROJECTS } from './constants'
import { formatCurrency, getCategoryLabel, getInteractionTypeLabel } from './utils'

// ===== Add Visit Dialog =====
interface AddVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newVisit: { engineerId: string; projectId: string; date: string; timeIn: string; notes: string }
  setNewVisit: (visit: { engineerId: string; projectId: string; date: string; timeIn: string; notes: string } | ((prev: { engineerId: string; projectId: string; date: string; timeIn: string; notes: string }) => { engineerId: string; projectId: string; date: string; timeIn: string; notes: string })) => void
  onAdd: () => void
}

export function AddVisitDialog({ open, onOpenChange, newVisit, setNewVisit, onAdd }: AddVisitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة زيارة جديدة</DialogTitle>
          <DialogDescription>تسجيل زيارة ميدانية للموقع</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>المهندس *</Label>
            <Select value={newVisit.engineerId} onValueChange={v => setNewVisit(p => ({ ...p, engineerId: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المهندس" /></SelectTrigger>
              <SelectContent>
                {DEMO_ENGINEERS.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المشروع *</Label>
            <Select value={newVisit.projectId} onValueChange={v => setNewVisit(p => ({ ...p, projectId: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
              <SelectContent>
                {DEMO_PROJECTS.filter(p => p.status === 'ACTIVE' || p.status === 'DELAYED').map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={newVisit.date} onChange={e => setNewVisit(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>وقت الوصول *</Label>
              <Input type="time" value={newVisit.timeIn} onChange={e => setNewVisit(p => ({ ...p, timeIn: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={newVisit.notes} onChange={e => setNewVisit(p => ({ ...p, notes: e.target.value }))} placeholder="أضف ملاحظات الزيارة..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={onAdd} disabled={!newVisit.engineerId || !newVisit.projectId || !newVisit.date}>
            إضافة الزيارة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Add BOQ Item Dialog =====
interface AddBoqItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newBoqItem: { description: string; unit: string; quantity: number; unitCost: number; category: BOQItem['category'] }
  setNewBoqItem: (item: { description: string; unit: string; quantity: number; unitCost: number; category: BOQItem['category'] } | ((prev: { description: string; unit: string; quantity: number; unitCost: number; category: BOQItem['category'] }) => { description: string; unit: string; quantity: number; unitCost: number; category: BOQItem['category'] })) => void
  onAdd: () => void
}

export function AddBoqItemDialog({ open, onOpenChange, newBoqItem, setNewBoqItem, onAdd }: AddBoqItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة بند جديد</DialogTitle>
          <DialogDescription>أضف بند إلى قائمة الكميات</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>وصف البند *</Label>
            <Input value={newBoqItem.description} onChange={e => setNewBoqItem(p => ({ ...p, description: e.target.value }))} placeholder="مثال: بلاط أرضيات" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الفئة *</Label>
              <Select value={newBoqItem.category} onValueChange={v => setNewBoqItem(p => ({ ...p, category: v as BOQItem['category'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['civil', 'structural', 'mep', 'finishing', 'landscape'] as const).map(c => (
                    <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الوحدة *</Label>
              <Select value={newBoqItem.unit} onValueChange={v => setNewBoqItem(p => ({ ...p, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['م²', 'م³', 'م.ط', 'طن', 'عدد', 'نقطة', 'محطة', 'كجم'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الكمية *</Label>
              <Input type="number" value={newBoqItem.quantity} onChange={e => setNewBoqItem(p => ({ ...p, quantity: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>سعر الوحدة (درهم) *</Label>
              <Input type="number" value={newBoqItem.unitCost} onChange={e => setNewBoqItem(p => ({ ...p, unitCost: Number(e.target.value) }))} />
            </div>
          </div>
          {newBoqItem.quantity > 0 && newBoqItem.unitCost > 0 && (
            <div className="p-3 rounded-lg bg-brand-navy-50 dark:bg-brand-navy-900/20 text-center">
              <span className="text-xs text-slate-500">الإجمالي: </span>
              <span className="text-lg font-bold text-brand-navy-700 dark:text-brand-navy-400">{formatCurrency(newBoqItem.quantity * newBoqItem.unitCost)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={onAdd} disabled={!newBoqItem.description || newBoqItem.quantity <= 0 || newBoqItem.unitCost <= 0}>
            إضافة البند
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Add Interaction Dialog =====
interface AddInteractionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newInteraction: { clientId: string; projectId: string; type: string; date: string; subject: string; description: string; outcome: string }
  setNewInteraction: (interaction: { clientId: string; projectId: string; type: string; date: string; subject: string; description: string; outcome: string } | ((prev: { clientId: string; projectId: string; type: string; date: string; subject: string; description: string; outcome: string }) => { clientId: string; projectId: string; type: string; date: string; subject: string; description: string; outcome: string })) => void
  onAdd: () => void
}

export function AddInteractionDialog({ open, onOpenChange, newInteraction, setNewInteraction, onAdd }: AddInteractionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل تواصل جديد</DialogTitle>
          <DialogDescription>سجل تفاعل جديد مع العميل</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>العميل *</Label>
              <Select value={newInteraction.clientId} onValueChange={v => setNewInteraction(p => ({ ...p, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {DEMO_PROJECTS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المشروع *</Label>
              <Select value={newInteraction.projectId} onValueChange={v => setNewInteraction(p => ({ ...p, projectId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                <SelectContent>
                  {DEMO_PROJECTS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>نوع التواصل *</Label>
              <Select value={newInteraction.type} onValueChange={v => setNewInteraction(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['meeting', 'call', 'email'] as const).map(t => (
                    <SelectItem key={t} value={t}>{getInteractionTypeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={newInteraction.date} onChange={e => setNewInteraction(p => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>الموضوع *</Label>
            <Input value={newInteraction.subject} onChange={e => setNewInteraction(p => ({ ...p, subject: e.target.value }))} placeholder="موضوع التواصل" />
          </div>
          <div className="space-y-2">
            <Label>التفاصيل</Label>
            <Textarea value={newInteraction.description} onChange={e => setNewInteraction(p => ({ ...p, description: e.target.value }))} placeholder="وصف تفصيلي..." />
          </div>
          <div className="space-y-2">
            <Label>النتيجة</Label>
            <Input value={newInteraction.outcome} onChange={e => setNewInteraction(p => ({ ...p, outcome: e.target.value }))} placeholder="نتيجة التواصل" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={onAdd} disabled={!newInteraction.clientId || !newInteraction.projectId || !newInteraction.subject}>
            تسجيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
