/** Route a request to exactly one persistence backend. Rejections propagate. */
export async function routeApiRequest(backend, endpoint, options, handlers) {
  if (backend === 'supabase') return await handlers.supabase(endpoint, options);
  if (backend === 'api' || backend === 'mongodb') {
    if (handlers.api) return await handlers.api(endpoint, options);
  }
  return await handlers.demo(endpoint, options);
}
