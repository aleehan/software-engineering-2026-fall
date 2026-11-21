interface PageHeaderProps {
  title: string
  meta?: string
}

/** Заголовок страницы: название контекста и тихая строка под ним. */
export function PageHeader({ title, meta }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {meta && <p className="meta">{meta}</p>}
    </header>
  )
}
