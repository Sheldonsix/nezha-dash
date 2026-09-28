'use client';

import { createContext, useContext, useState } from 'react';
import { Button } from './ui/button';
import { Check, ClipboardCopy } from 'lucide-react';

export type CreatedNodeCommand = {
  username: string;
  command: string;
};

type ContextValue = {
  createdNode: CreatedNodeCommand | null;
  setCreatedNode: (createdNode: CreatedNodeCommand | null) => void;
};

const Context = createContext<ContextValue | null>(null);

export function CreatedNodeCommandProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [createdNode, setCreatedNode] = useState<CreatedNodeCommand | null>(
    null,
  );
  return (
    <Context.Provider value={{ createdNode, setCreatedNode }}>
      {children}
    </Context.Provider>
  );
}

export function useCreatedNodeCommand() {
  const value = useContext(Context);
  if (!value) {
    throw new Error(
      'useCreatedNodeCommand must be used within a CreatedNodeCommandProvider',
    );
  }
  return value;
}

export function CreatedNodeCopyButton({
  username,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  username: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
}) {
  const { createdNode } = useCreatedNodeCommand();
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const matches = createdNode?.username === username;

  async function copyCommand() {
    if (!createdNode) return;
    try {
      await navigator.clipboard.writeText(createdNode!.command);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  const label =
    status === 'idle'
      ? copyLabel
      : status === 'copied'
        ? copiedLabel
        : copyFailedLabel;

  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center">
      {matches && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-9 p-0"
            onClick={copyCommand}
            aria-live="polite"
            aria-label={label}
            title={label}
          >
            {status === 'copied' ? (
              <Check className="size-4" />
            ) : (
              <ClipboardCopy className="size-4" />
            )}
          </Button>
          <span className="sr-only" aria-live="polite">
            {status === 'idle' ? '' : label}
          </span>
        </>
      )}
    </span>
  );
}
