// frontend/src/components/PipelineKanban.jsx
import { useState, useEffect } from 'react';
import { DndContext, useDroppable, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RiFocus3Line, RiDeleteBinLine } from 'react-icons/ri';
import './PipelineKanban.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STAGES = [
  { key: 'new',          label: 'New',          color: '#94a3b8' },
  { key: 'researched',   label: 'Researched',   color: '#60a5fa' },
  { key: 'called',       label: 'Called',       color: '#a78bfa' },
  { key: 'demo_booked',  label: 'Demo Booked',  color: '#34d399' },
  { key: 'closed_won',   label: 'Closed Won',   color: '#10b981' },
  { key: 'closed_lost',  label: 'Closed Lost',  color: '#f87171' }
];

const STAGE_KEYS = STAGES.map(s => s.key);

function PipelineCard({ item, isDragging, onDelete, onDealValueChange }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const [dealValue, setDealValue] = useState(item.deal_value > 0 ? item.deal_value : '');

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="pipeline-card">
      <div className="card-top-row">
        <div className="card-name">{item.company_name}</div>
        <button
          className="card-delete"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(item.id); }}
          title="Remove from pipeline"
        >
          <RiDeleteBinLine size={13} />
        </button>
      </div>
      <div className="card-meta">
        {item.icp_score && <span className="card-icp">ICP {item.icp_score}</span>}
        {item.sector && <span className="card-sector">{item.sector}</span>}
      </div>
      {item.next_action && <div className="card-action">→ {item.next_action}</div>}
      <input
        className="card-deal-input"
        type="number"
        placeholder="Deal $"
        value={dealValue}
        onPointerDown={e => e.stopPropagation()}
        onChange={e => setDealValue(e.target.value)}
        onBlur={e => {
          const v = parseFloat(e.target.value) || 0;
          onDealValueChange(item.id, v);
        }}
        title="Deal value"
      />
    </div>
  );
}

function DroppableColumn({ stage, items, activeId, onDelete, onDealValueChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div className={`kanban-column${isOver ? ' column-over' : ''}`}>
      <div className="column-header">
        <span className="column-dot" style={{ background: stage.color }} />
        <span className="column-label">{stage.label}</span>
        <span className="column-count">{items.length}</span>
      </div>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="column-body" ref={setNodeRef}>
          {items.map(item => (
            <PipelineCard
              key={item.id}
              item={item}
              isDragging={activeId === item.id}
              onDelete={onDelete}
              onDealValueChange={onDealValueChange}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelineKanban({ isOpen, onClose, refreshTrigger }) {
  const [pipeline, setPipeline] = useState({});
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (isOpen) {
      fetch(`${API}/api/pipeline`).then(r => r.json()).then(setPipeline).catch(console.error);
    }
  }, [isOpen, refreshTrigger]);

  const findStageOfItem = (id) => {
    for (const [stage, items] of Object.entries(pipeline)) {
      if (items.find(i => i.id === id)) return stage;
    }
    return null;
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null);
    if (!over) return;

    const fromStage = findStageOfItem(active.id);
    // over.id is either a stage key (dropped on column) or a card id (dropped on card)
    const toStage = STAGE_KEYS.includes(over.id)
      ? over.id
      : findStageOfItem(over.id);

    if (!fromStage || !toStage || fromStage === toStage) return;

    const item = pipeline[fromStage]?.find(i => i.id === active.id);
    if (!item) return;

    // Optimistic update
    setPipeline(prev => ({
      ...prev,
      [fromStage]: prev[fromStage].filter(i => i.id !== active.id),
      [toStage]: [...(prev[toStage] || []), { ...item, stage: toStage }]
    }));

    await fetch(`${API}/api/pipeline/${active.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: toStage })
    }).catch(console.error);
  };

  const handleDelete = async (id) => {
    // Find which stage this item is in
    const stage = Object.entries(pipeline).find(([, items]) => items.find(i => i.id === id))?.[0];
    if (!stage) return;
    // Optimistic removal
    setPipeline(prev => ({ ...prev, [stage]: prev[stage].filter(i => i.id !== id) }));
    await fetch(`${API}/api/pipeline/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleDealValueChange = async (id, value) => {
    await fetch(`${API}/api/pipeline/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_value: value }),
    }).catch(console.error);
    // Update local state so the KPI reflects new value on next load
    setPipeline(prev => {
      const updated = { ...prev };
      for (const stage of Object.keys(updated)) {
        updated[stage] = updated[stage].map(item =>
          item.id === id ? { ...item, deal_value: value } : item
        );
      }
      return updated;
    });
  };

  const totalMoved = (pipeline.demo_booked?.length || 0) + (pipeline.closed_won?.length || 0);

  if (!isOpen) return null;

  return (
    <div className="kanban-overlay">
      <div className="kanban-drawer">
        <div className="kanban-header">
          <h2>Pipeline</h2>
          {totalMoved > 0 && <span className="kanban-metric"><RiFocus3Line size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{totalMoved} demos/wins this pipeline</span>}
          <button className="kanban-close" onClick={onClose}>✕</button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd}>
          <div className="kanban-board">
            {STAGES.map(stage => (
              <DroppableColumn
                key={stage.key}
                stage={stage}
                items={pipeline[stage.key] || []}
                activeId={activeId}
                onDelete={handleDelete}
                onDealValueChange={handleDealValueChange}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
