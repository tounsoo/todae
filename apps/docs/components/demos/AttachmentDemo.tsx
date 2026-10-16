'use client';

import { Attachment, Button, Stack } from '@tounsoo/todae';
import { FileText, Image } from 'lucide-react';
import { useEffect, useState } from 'react';

type Item = { name: string; size: string; kind: 'image' | 'document'; status: 'ready' | 'uploading' | 'error'; progress?: number };

const START: Item[] = [
  { name: 'quarterly-report.pdf', size: '1.2 MB', kind: 'document', status: 'ready' },
  { name: 'whiteboard.jpg', size: '3.4 MB', kind: 'image', status: 'uploading', progress: 0 },
  { name: 'recording.mov', size: '412 MB', kind: 'document', status: 'error' },
];

export function AttachmentExample() {
  const [files, setFiles] = useState(START);
  const uploading = files.some((file) => file.status === 'uploading');

  // Stands in for the product's upload, which reports how far it has come.
  useEffect(() => {
    if (!uploading) return;
    const timer = setInterval(() => {
      setFiles((all) =>
        all.map((file) => {
          if (file.status !== 'uploading') return file;
          const progress = (file.progress ?? 0) + 10;
          return progress >= 100 ? { ...file, status: 'ready', progress: undefined } : { ...file, progress };
        }),
      );
    }, 400);
    return () => clearInterval(timer);
  }, [uploading]);

  return (
    <Stack.Root gap="normal">
      <Stack.Root as="ul" direction="row" gap="condensed" wrap aria-label="Attached files">
        {files.map((file) => (
          <li key={file.name}>
            <Attachment.Root status={file.status}>
              <Attachment.Preview>{file.kind === 'image' ? <Image aria-hidden /> : <FileText aria-hidden />}</Attachment.Preview>
              <Attachment.Name>{file.name}</Attachment.Name>
              <Attachment.Meta>
                {file.status === 'error' ? 'Too large to upload' : file.status === 'uploading' ? `Uploading, ${file.progress}%` : file.size}
              </Attachment.Meta>
              {file.status === 'uploading' ? <Attachment.Progress value={file.progress} max={100} /> : null}
              <Attachment.Remove onClick={() => setFiles((all) => all.filter((other) => other.name !== file.name))} />
            </Attachment.Root>
          </li>
        ))}
      </Stack.Root>
      {files.length < START.length ? (
        <div>
          <Button.Root variant="secondary" onClick={() => setFiles(START)}>
            Put the files back
          </Button.Root>
        </div>
      ) : null}
    </Stack.Root>
  );
}
