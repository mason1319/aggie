interface SectionTitleProps {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

export function SectionTitle({ eyebrow, title, description, align = 'center' }: SectionTitleProps) {
  return (
    <div className={`section-title ${align}`}>
      <span className="mini-label">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  )
}
