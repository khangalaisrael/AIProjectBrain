interface PageHeaderProps {
  title: string;
  description?: string;
}

/** Consistent page title + subtitle used across the app's primary pages. */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
    </div>
  );
}
