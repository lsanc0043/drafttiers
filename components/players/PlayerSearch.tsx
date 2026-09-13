type PlayerSearchProps = {
  query?: string;
};

export function PlayerSearch({ query = "" }: PlayerSearchProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-500">Search NBA players</span>
      <input
        defaultValue={query}
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        placeholder="Player name"
        disabled
      />
    </label>
  );
}
