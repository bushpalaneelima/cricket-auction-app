import { supabase } from "./lib/supabaseClient";

export default async function Home() {
  // Read 1 row from the "players" table
  const { data, error } = await supabase
    .from("players") // table name in your Supabase
    .select("*")
    .limit(1);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">
        Supabase Connection Test
      </h1>

      {error && (
        <p className="text-red-600">
          Error: {error.message}
        </p>
      )}

      {!error && data && data.length > 0 && (
        <pre className="mt-4 text-sm">
          {JSON.stringify(data[0], null, 2)}
        </pre>
      )}

      {!error && (!data || data.length === 0) && (
        <p className="mt-4">
          No rows found in "players" table.
        </p>
      )}
    </main>
  );
}
