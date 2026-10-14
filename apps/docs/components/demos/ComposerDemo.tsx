'use client';

import { Attachment, Button, Composer, Field, Message, Stack, useDropzone } from '@omsoo.design/todae';
import { FileText, Paperclip } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

type Sent = { id: number; text: string; files: string[] };

export function ComposerExample() {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const field = useRef<HTMLTextAreaElement>(null);
  const zone = useDropzone({
    multiple: true,
    paste: true,
    onFiles: (accepted) => setFiles((all) => [...all, ...accepted]),
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent((all) => [...all, { id: all.length, text: value, files: files.map((file) => file.name) }]);
    setValue('');
    setFiles([]);
    // Stands in for the product's request, which runs until the reply is done.
    setBusy(true);
    timer.current = setTimeout(() => setBusy(false), 3000);
  };
  const stop = () => {
    clearTimeout(timer.current);
    setBusy(false);
  };

  return (
    <Stack.Root gap="normal" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {sent.map((message) => (
        <Message.Root key={message.id} from="user" aria-label="You">
          <Message.Content>
            {message.text}
            {message.files.length > 0 ? ` (${message.files.join(', ')})` : null}
          </Message.Content>
        </Message.Root>
      ))}
      <Composer.Root busy={busy} onSubmit={send} {...zone.getRootProps()}>
        <Field.Root aria-label="Message">
          {files.length > 0 ? (
            <Field.Row>
              <Stack.Root as="ul" direction="row" gap="condensed" wrap aria-label="Attached files">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    <Attachment.Root>
                      <Attachment.Preview>
                        <FileText aria-hidden />
                      </Attachment.Preview>
                      <Attachment.Name>{file.name}</Attachment.Name>
                      <Attachment.Remove
                        onClick={() => {
                          // After the last file, focus goes back to the text field.
                          if (files.length === 1) field.current?.focus();
                          setFiles((all) => all.filter((other) => other !== file));
                        }}
                      />
                    </Attachment.Root>
                  </li>
                ))}
              </Stack.Root>
            </Field.Row>
          ) : null}
          <Field.Textarea
            ref={field}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ask anything, or paste a file"
            autoGrow
            maxRows={6}
          />
          <Field.Row>
            <Button.Root variant="ghost" aria-label="Attach files" onClick={() => zone.getInputProps().ref.current?.click()}>
              <Button.Icon>
                <Paperclip />
              </Button.Icon>
            </Button.Root>
            <input {...zone.getInputProps()} hidden />
            <Composer.Submit disabled={value.trim() === '' && files.length === 0} onStop={stop} />
          </Field.Row>
        </Field.Root>
      </Composer.Root>
    </Stack.Root>
  );
}
