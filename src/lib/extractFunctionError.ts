// supabase-js's functions.invoke() throws a FunctionsHttpError whose
// `.message` is ALWAYS the hardcoded string "Edge Function returned a
// non-2xx status code" -- the real reason the backend sent lives in
// `error.context` (the raw Response object) and has to be read out
// explicitly (see @supabase/functions-js FunctionsClient.js doc comment:
// `const errorMessage = await error.context.json()`). Every call site that
// did `toast.error(err.message)` was showing that same useless generic
// string no matter what actually went wrong server-side.
export async function extractFunctionErrorMessage(error: any, fallback = 'Something went wrong'): Promise<string> {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    }
  } catch {
    // context wasn't JSON, already consumed, or missing -- fall through
  }
  return error?.message || fallback;
}
