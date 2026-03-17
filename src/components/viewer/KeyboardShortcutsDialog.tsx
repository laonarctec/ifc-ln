import { X } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: 'H', description: '선택 객체 숨기기' },
  { key: 'I', description: '선택 객체만 보기 (Isolate)' },
  { key: 'S', description: '전체 다시 보기 (Show All)' },
  { key: 'F', description: '선택 객체에 맞춰 보기 (Fit Selected)' },
  { key: 'Z', description: '전체 모델에 맞춤 (Fit All)' },
  { key: 'Esc', description: '선택 해제' },
  { key: '0', description: 'Home (Isometric)' },
  { key: '1', description: 'Front 뷰' },
  { key: '2', description: 'Bottom 뷰' },
  { key: '3', description: 'Right 뷰' },
  { key: '4', description: 'Back 뷰' },
  { key: '5', description: 'Left 뷰' },
  { key: '6', description: 'Right 뷰' },
  { key: '7', description: 'Top 뷰' },
];

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  if (!open) return null;

  return (
    <div className="shortcuts-dialog__backdrop" onClick={onClose}>
      <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-dialog__header">
          <h2>키보드 단축키</h2>
          <button type="button" className="shortcuts-dialog__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="shortcuts-dialog__body">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="shortcuts-dialog__row">
              <kbd className="shortcuts-dialog__key">{key}</kbd>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
