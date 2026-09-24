export function SearchForm({ initialValue = "" }: { initialValue?: string }) {
  return <form className="search-form" action="/search" role="search"><label htmlFor="site-search" className="sr-only">Search Teens2Inspire</label><span aria-hidden="true">⌕</span><input id="site-search" name="q" defaultValue={initialValue} placeholder="Search conversations, resources, events..." /><button type="submit">Search</button></form>;
}
