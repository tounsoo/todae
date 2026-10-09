'use client';

import { Description, ErrorMessage, Stack, Text, useDropzone, type FileRejection, type FileRejectionReason } from '@omsoo/todae';
import { useId, useState } from 'react';

const MAX_SIZE = 2_000_000;

const REASONS: Record<FileRejectionReason, string> = {
  type: 'is not an image',
  'too-large': 'is over 2 MB',
  'too-small': 'is empty',
  'too-many': 'is past the 3 file limit',
};

export function FileUploadImages() {
  const hintId = useId();
  const errorId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<FileRejection[]>([]);
  const zone = useDropzone({
    accept: 'image/*',
    multiple: true,
    maxFiles: 3,
    maxSize: MAX_SIZE,
    minSize: 1,
    onFiles: (accepted, failed) => {
      setFiles(accepted);
      setRejected(failed);
    },
  });
  return (
    <Stack>
      <label
        {...zone.getRootProps()}
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 'var(--todae-space-3)',
          padding: 'var(--todae-space-6)',
          border: '2px dashed var(--todae-color-border-default)',
          borderRadius: 'var(--todae-radius-md)',
          background: zone.dragging ? 'var(--todae-color-bg-subtle)' : undefined,
        }}
      >
        <Text as="span">Drop images here, or choose them</Text>
        <input
          {...zone.getInputProps()}
          name="images"
          aria-invalid={rejected.length > 0 || undefined}
          aria-describedby={rejected.length > 0 ? `${hintId} ${errorId}` : hintId}
        />
      </label>
      <Description id={hintId}>Up to 3 images, 2 MB each.</Description>
      {rejected.length > 0 ? (
        <ErrorMessage id={errorId}>
          {rejected.map(({ file, reasons }) => `${file.name} ${reasons.map((reason) => REASONS[reason]).join(' and ')}.`).join(' ')}
        </ErrorMessage>
      ) : null}
      {files.length > 0 ? (
        <ul aria-label="Chosen images">
          {files.map((file, index) => (
            <li key={`${index}:${file.name}`}>{file.name}</li>
          ))}
        </ul>
      ) : null}
    </Stack>
  );
}
