'use client';

import { Plus } from 'lucide-react';
import { type ReactNode, useActionState, useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
  CreatedNodeCommand,
  useCreatedNodeCommand,
} from './CreatedNodeCommand';

export function CreateServerForm({
  createAction,
  createLabel,
  children,
}: {
  createAction: (
    previousState: CreatedNodeCommand,
    formData: FormData,
  ) => Promise<CreatedNodeCommand>;
  children?: ReactNode;
  createLabel: string;
}) {
  const { setCreatedNode } = useCreatedNodeCommand();
  const [state, formAction, pending] = useActionState(createAction, {
    command: '',
    username: '',
  });
  useEffect(() => {
    if (state.username && state.command) {
      setCreatedNode(state);
    }
  }, [state, setCreatedNode]);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-3">
      {children}
      <div className="col-span-full flex justify-end">
        <Button type="submit" disabled={pending} className="gap-2">
          <Plus className="size-4" />
          {createLabel}
        </Button>
      </div>
    </form>
  );
}
