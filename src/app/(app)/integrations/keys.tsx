"use client";

import { useActionState } from "react";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export function KeyForm() {
  const [state, action, pending] = useActionState(createApiKeyAction, null);
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="Nom de l'intégration (ex. site web)" className="input max-w-xs" />
        <button className="btn-primary" disabled={pending}>Créer une clé</button>
      </form>
      {state?.key && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Copiez cette clé maintenant, elle ne sera plus affichée :
          <code className="mt-1 block break-all rounded bg-white p-2 font-mono">{state.key}</code>
        </div>
      )}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  return (
    <form action={revokeApiKeyAction.bind(null, id)}>
      <button className="text-xs text-red-600 hover:underline">Révoquer</button>
    </form>
  );
}
