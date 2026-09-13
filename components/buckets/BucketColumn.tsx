type BucketColumnProps = {
  name: string;
};

export function BucketColumn({ name }: BucketColumnProps) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h2 className="text-sm font-medium">{name}</h2>
    </div>
  );
}
