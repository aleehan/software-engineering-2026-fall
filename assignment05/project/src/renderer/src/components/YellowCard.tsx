/**
 * Жёлтая карточка судьи — появляется на табло, когда лимит исчерпан.
 * Нарисована в CSS: лёгкий перепад тона одного жёлтого, блик по краю и мягкая тень,
 * чтобы читалась как предмет, а не как плашка.
 */
export function YellowCard(): React.JSX.Element {
  return <div className="yellow-card" aria-hidden="true" />
}
