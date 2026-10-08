export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const type = response.headers.get("Content-Type");
  if (!type?.includes("application/json"))
    throw new Error(
      "Sua sessão precisa ser renovada. Abra o painel novamente para entrar.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      (result as { error?: string }).error ||
        "Não foi possível concluir a operação.",
    );
  return result as T;
}
export const body = (value: unknown) => JSON.stringify(value);
