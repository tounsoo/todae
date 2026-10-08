import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from 'react';

export type FileRejectionReason = 'type' | 'too-large' | 'too-small' | 'too-many';

export type FileRejection = {
  file: File;
  /** Every rule the file broke. 'too-many' is only given to a file that passed the others. */
  reasons: readonly FileRejectionReason[];
};

export type UseDropzoneOptions = {
  /** File types to take, in the input's accept syntax: '.pdf', 'image/*', 'application/json', comma separated. Checked on drop too. */
  accept?: string;
  /** Take more than one file. */
  multiple?: boolean;
  /** Most files to take when multiple is set. Files past it are rejected as 'too-many'. */
  maxFiles?: number;
  /** Largest file size in bytes. */
  maxSize?: number;
  /** Smallest file size in bytes. */
  minSize?: number;
  /** Turn off the input and drops. */
  disabled?: boolean;
  /** Called with the files that passed and the files that did not, after a drop or a pick. */
  onFiles?: (accepted: File[], rejected: FileRejection[]) => void;
};

export type UseDropzoneRootProps = {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  'data-dragging'?: '';
};

export type UseDropzoneInputProps = {
  ref: RefObject<HTMLInputElement | null>;
  type: 'file';
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export type UseDropzoneResult = {
  /** True while files are dragged over the root. */
  dragging: boolean;
  /** Drag and drop handlers for the drop target, usually the input's label. */
  getRootProps: () => UseDropzoneRootProps;
  /** Props for the native file input. */
  getInputProps: () => UseDropzoneInputProps;
};

/** Whether a file matches an accept string, the way the file picker reads it. */
export function acceptsFile(file: Pick<File, 'name' | 'type'>, accept: string | undefined): boolean {
  const rules = (accept ?? '')
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/** Dropped files without folders, which browsers list as typeless files. */
function droppedFiles(data: DataTransfer): File[] {
  const items = Array.from(data.items ?? []);
  if (items.length === 0) return Array.from(data.files);
  return items.flatMap((item) => {
    if (item.kind !== 'file' || item.webkitGetAsEntry?.()?.isDirectory) return [];
    const file = item.getAsFile();
    return file ? [file] : [];
  });
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

export function useDropzone(options: UseDropzoneOptions = {}): UseDropzoneResult {
  const { accept, multiple = false, disabled = false } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const active = dragging && !disabled;

  const take = (files: readonly File[]) => {
    const { maxSize, minSize, maxFiles, onFiles } = options;
    const limit = multiple ? (maxFiles ?? Infinity) : 1;
    const accepted: File[] = [];
    const rejected: FileRejection[] = [];
    for (const file of files) {
      const reasons: FileRejectionReason[] = [];
      if (!acceptsFile(file, accept)) reasons.push('type');
      if (maxSize !== undefined && file.size > maxSize) reasons.push('too-large');
      if (minSize !== undefined && file.size < minSize) reasons.push('too-small');
      if (reasons.length === 0 && accepted.length >= limit) reasons.push('too-many');
      if (reasons.length === 0) accepted.push(file);
      else rejected.push({ file, reasons });
    }
    // Keep only the accepted files in the input, so a native form submits what passed.
    const input = inputRef.current;
    // jsdom has no DataTransfer constructor; every supported browser does.
    if (input && typeof DataTransfer === 'function') {
      const kept = new DataTransfer();
      for (const file of accepted) kept.items.add(file);
      input.files = kept.files;
    }
    onFiles?.(accepted, rejected);
  };

  const endDrag = () => {
    depth.current = 0;
    setDragging(false);
  };

  const getRootProps = (): UseDropzoneRootProps => ({
    onDragEnter: (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (disabled) return;
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (event) => {
      if (!hasFiles(event)) return;
      // Cancelling dragover is what allows a drop; 'none' refuses it while disabled.
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    },
    onDragLeave: (event) => {
      // Not gated on disabled, so a drag that started enabled still ends.
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      endDrag();
      if (disabled) return;
      const files = droppedFiles(event.dataTransfer);
      if (files.length > 0) take(files);
    },
    ...(active ? { 'data-dragging': '' as const } : {}),
  });

  const getInputProps = (): UseDropzoneInputProps => ({
    ref: inputRef,
    type: 'file',
    accept,
    multiple,
    disabled,
    onChange: (event) => take(Array.from(event.currentTarget.files ?? [])),
  });

  return { dragging: active, getRootProps, getInputProps };
}
